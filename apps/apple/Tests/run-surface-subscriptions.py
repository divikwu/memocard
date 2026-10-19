#!/usr/bin/env python3
"""Build a simulator probe with the real app sources, without editing its project."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time

root = Path(__file__).resolve().parents[3]
parser = argparse.ArgumentParser()
parser.add_argument("--device", default="auto", help="Existing iOS simulator UUID, or auto to discover an available iPhone")
parser.add_argument("--output-dir", type=Path, help="New directory retaining evidence; omitted temporary builds are cleaned up")
parser.add_argument("--source-dir", type=Path, default=root / "apps/apple/Sources", help="Production sources, or a retained baseline snapshot")
parser.add_argument("--baseline", action="store_true", help="Measure the former Host-wide publisher in a retained old source snapshot")
args = parser.parse_args()

def select_device():
    if args.device != "auto":
        return args.device, False
    runtimes = json.loads(subprocess.check_output(["xcrun", "simctl", "list", "runtimes", "--json"]))["runtimes"]
    devices = json.loads(subprocess.check_output(["xcrun", "simctl", "list", "devices", "available", "--json"]))["devices"]
    runtimes = sorted((runtime for runtime in runtimes if runtime.get("isAvailable") and ".iOS-" in runtime["identifier"]), key=lambda runtime: tuple(map(int, runtime["version"].split("."))), reverse=True)
    for runtime in runtimes:
        booted = next((device for device in devices.get(runtime["identifier"], []) if device["name"].startswith("iPhone") and device["state"] == "Booted"), None)
        if booted:
            return booted["udid"], False
    for runtime in runtimes:
        phones = [device for device in runtime.get("supportedDeviceTypes", []) if device.get("productFamily") == "iPhone"]
        existing = [device for device in devices.get(runtime["identifier"], []) if device["name"].startswith("iPhone")]
        if existing:
            existing.sort(key=lambda device: device["state"] != "Booted")
            return existing[0]["udid"], False
        if phones:
            device = subprocess.check_output(["xcrun", "simctl", "create", "MemoCard Surface Tests", phones[0]["identifier"], runtime["identifier"]], text=True).strip()
            return device, True
    raise RuntimeError("Native surface tests require an available iOS Simulator runtime with iPhone support")

def diagnostic(kind, command, timeout):
    try:
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=timeout)
        output = result.stdout
        status = {"kind": kind, "exitCode": result.returncode}
    except subprocess.TimeoutExpired as error:
        output = error.stdout or ""
        if isinstance(output, bytes):
            output = output.decode(errors="replace")
        status = {"kind": kind, "error": str(error), "timeoutSeconds": timeout}
    except Exception as error:
        print("SURFACE_PROBE_DIAGNOSTIC " + json.dumps({"kind": kind, "error": str(error)}), flush=True)
        return
    section = "first" if kind == "install-sample" else "last"
    print("SURFACE_PROBE_DIAGNOSTIC " + json.dumps({**status, "truncated": len(output) > 20000, "section": section}), flush=True)
    if len(output) > 20000:
        print(f"[diagnostic truncated to {section} 20000 characters]", flush=True)
    print(output[:20000] if section == "first" else output[-20000:], flush=True)

def incomplete_probe_diagnostics(launch_started):
    diagnostic("app-lifecycle-log", ["xcrun", "simctl", "spawn", device, "log", "show", "--last", "2m", "--style", "compact", "--predicate", 'process == "MemoCard" OR eventMessage CONTAINS "dev.divikwu.memocard.surface-probe"'], 10)
    try:
        reports = Path.home() / "Library/Logs/DiagnosticReports"
        candidates = [path for pattern in ("MemoCard*.ips", "MemoCard*.crash") for path in reports.glob(pattern) if path.stat().st_mtime >= launch_started]
        candidates.sort(key=lambda path: path.stat().st_mtime, reverse=True)
        print("SURFACE_PROBE_DIAGNOSTIC " + json.dumps({"kind": "app-crash-reports", "count": len(candidates), "shown": min(2, len(candidates))}), flush=True)
        for path in candidates[:2]:
            with path.open(errors="replace") as report:
                output = report.read(20001)
            print("SURFACE_PROBE_DIAGNOSTIC " + json.dumps({"kind": "app-crash-report", "file": path.name, "section": "first", "truncated": len(output) > 20000}), flush=True)
            if len(output) > 20000:
                print("[diagnostic truncated to first 20000 characters]", flush=True)
            print(output[:20000], flush=True)
    except Exception as error:
        print("SURFACE_PROBE_DIAGNOSTIC " + json.dumps({"kind": "app-crash-reports", "error": str(error)}), flush=True)

def phase(name, command, timeout, capture=False):
    started = time.monotonic()
    print("SURFACE_PROBE_PHASE " + json.dumps({"phase": name, "event": "start", "device": device, "timeoutSeconds": timeout}), flush=True)
    process = subprocess.Popen(command, stdout=subprocess.PIPE if capture else None, stderr=subprocess.STDOUT, text=True)
    outcome = "failed"
    try:
        output, _ = process.communicate(timeout=timeout)
        if process.returncode:
            if capture and output:
                print(output, flush=True)
            raise subprocess.CalledProcessError(process.returncode, command, output=output)
        outcome = "passed"
        return output
    except subprocess.TimeoutExpired as error:
        outcome = "timeout"
        print("SURFACE_PROBE_PHASE " + json.dumps({"phase": name, "event": "deadline", "outcome": outcome, "seconds": round(time.monotonic() - started, 3)}), flush=True)
        if capture and error.stdout:
            output = error.stdout.decode(errors="replace") if isinstance(error.stdout, bytes) else error.stdout
            print(output, flush=True)
        if name == "install":
            # The install deadline has already failed. Sample its live IPC wait
            # before terminating it; diagnosis never extends the success window.
            diagnostic("install-sample", ["sample", str(process.pid), "1"], 5)
        try:
            process.kill()
            process.communicate(timeout=5)
        except Exception as error:
            print("SURFACE_PROBE_DIAGNOSTIC " + json.dumps({"kind": "process-cleanup", "error": str(error)}), flush=True)
        if name == "install":
            diagnostic("host-simulator-log", ["/usr/bin/log", "show", "--last", "2m", "--style", "compact", "--predicate", 'process == "CoreSimulatorService" OR process == "simdiskimaged"'], 10)
            diagnostic("device-install-log", ["xcrun", "simctl", "spawn", device, "log", "show", "--last", "2m", "--style", "compact", "--predicate", 'process == "installd" OR process == "installcoordinationd"'], 10)
        raise
    finally:
        print("SURFACE_PROBE_PHASE " + json.dumps({"phase": name, "event": "finish", "outcome": outcome, "seconds": round(time.monotonic() - started, 3), "exitCode": process.returncode}), flush=True)

def run(directory):
    shutil.copytree(args.source_dir, directory / "Sources")
    shutil.copy(root / "apps/apple/Tests/NativeSurfaceSubscriptionHarness.swift", directory / "Harness.swift")
    hashes = {path.name: hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted((directory / "Sources").glob("*.swift"))}
    (directory / "source-sha256.json").write_text(json.dumps(hashes, indent=2) + "\n")
    original = root / "apps/apple/MemoCard.xcodeproj"
    project = directory / "MemoCard.xcodeproj"
    project.mkdir()
    data = json.loads(subprocess.check_output(["plutil", "-convert", "json", "-o", "-", str(original / "project.pbxproj")]))
    objects = data["objects"]
    missing = [key for key, item in objects.items() if item["isa"] == "PBXFileReference" and item.get("path", "").endswith(".swift") and item.get("path") not in ["SidebarPerformanceTests.swift", "ServiceApp.swift", "ServiceHost.swift"] and not (directory / "Sources" / item["path"]).exists()]
    for item in objects.values():
        if item["isa"] == "PBXSourcesBuildPhase":
            item["files"] = [key for key in item["files"] if objects[key].get("fileRef") not in missing]
    for item in objects.values():
        if item["isa"] == "PBXGroup" and item.get("path") in ["Sources", "Service", "UITests"]:
            item["path"] = str(directory / "Sources") if item["path"] == "Sources" else str(root / "apps/apple" / item["path"])
            item["sourceTree"] = "<absolute>"
        elif item["isa"] == "PBXFileReference" and item.get("path") == "MemoCardApp.swift":
            item["path"] = str(directory / "Harness.swift")
            item["sourceTree"] = "<absolute>"
        elif item["isa"] == "XCLocalSwiftPackageReference":
            item["relativePath"] = str((original.parent / item["relativePath"]).resolve())
        elif item["isa"] == "PBXResourcesBuildPhase":
            item["files"] = []
        elif item["isa"] == "XCBuildConfiguration":
            settings = item["buildSettings"]
            if "INFOPLIST_FILE" in settings:
                settings["INFOPLIST_FILE"] = str(root / "apps/apple" / settings["INFOPLIST_FILE"])
            settings["PRODUCT_BUNDLE_IDENTIFIER"] = "dev.divikwu.memocard.surface-probe"
            settings.pop("ASSETCATALOG_COMPILER_APPICON_NAME", None)
            if args.baseline and settings.get("SDKROOT") == "iphoneos" and item["name"] == "Debug":
                settings["SWIFT_ACTIVE_COMPILATION_CONDITIONS"] = "DEBUG SURFACE_SUBSCRIPTION_BASELINE"
    (project / "project.pbxproj").write_text(json.dumps(data))
    schemes = project / "xcshareddata/xcschemes"
    schemes.mkdir(parents=True)
    (schemes / "MemoCardiOS.xcscheme").write_text((original / "xcshareddata/xcschemes/MemoCardiOS.xcscheme").read_text())
    command = ["xcodebuild", "-project", str(project), "-scheme", "MemoCardiOS", "-configuration", "Debug", "-destination", f"platform=iOS Simulator,id={device}", "-derivedDataPath", str(directory / "build"), "CODE_SIGNING_ALLOWED=NO", "build"]
    phase("build", command, 600)
    phase("runtime-cache", ["xcrun", "simctl", "runtime", "dyld_shared_cache", "update", runtime], 600)
    phase("bootstatus", ["xcrun", "simctl", "bootstatus", device, "-b"], 180)
    installed = False
    try:
        phase("install", ["xcrun", "simctl", "install", device, str(directory / "build/Build/Products/Debug-iphonesimulator/MemoCard.app")], 180)
        installed = True
        launch_started = time.time()
        launch = phase("launch", ["xcrun", "simctl", "launch", "--console", device, "dev.divikwu.memocard.surface-probe"], 60, capture=True)
        print(launch)
        marker = "SURFACE_SUBSCRIPTION_RESULT "
        result = next((json.loads(line.removeprefix(marker)) for line in launch.splitlines() if line.startswith(marker)), None)
        if result is None:
            incomplete_probe_diagnostics(launch_started)
            raise RuntimeError("Surface probe exited without completing its assertions")
        (directory / "result.json").write_text(json.dumps(result, indent=2) + "\n")
        if args.output_dir:
            print(f"Native surface evidence: {directory}")
        else:
            print("Native surface assertions passed")
    finally:
        if installed:
            had_error = sys.exc_info()[0] is not None
            try:
                phase("uninstall", ["xcrun", "simctl", "uninstall", device, "dev.divikwu.memocard.surface-probe"], 180)
            except Exception as error:
                if not had_error:
                    raise
                print("SURFACE_PROBE_DIAGNOSTIC " + json.dumps({"kind": "probe-cleanup", "error": str(error)}), flush=True)

device, created_device = select_device()
try:
    inventory = json.loads(subprocess.check_output(["xcrun", "simctl", "list", "devices", "--json"]))["devices"]
    runtime = next((runtime for runtime, devices in inventory.items() if any(item["udid"] == device for item in devices)), None)
    if runtime is None:
        raise RuntimeError(f"Cannot resolve the runtime for Simulator {device}")
    print("SURFACE_PROBE_DEVICE " + json.dumps({"device": device, "runtime": runtime, "created": created_device}), flush=True)
    if args.output_dir:
        directory = args.output_dir.resolve()
        directory.mkdir(parents=True, exist_ok=False)
        run(directory)
    else:
        with tempfile.TemporaryDirectory(prefix="memocard-surfaces-") as temporary:
            run(Path(temporary))
finally:
    if created_device:
        had_error = sys.exc_info()[0] is not None
        try:
            subprocess.run(["xcrun", "simctl", "shutdown", device], check=False, timeout=30)
            subprocess.run(["xcrun", "simctl", "delete", device], check=True, timeout=30)
        except Exception as error:
            if not had_error:
                raise
            print("SURFACE_PROBE_DIAGNOSTIC " + json.dumps({"kind": "device-cleanup", "error": str(error)}), flush=True)
