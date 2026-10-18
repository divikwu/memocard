#!/usr/bin/env python3
"""Build a simulator probe with the real app sources, without editing its project."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

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
    subprocess.run(command, check=True, timeout=600)
    subprocess.run(["xcrun", "simctl", "bootstatus", device, "-b"], check=True, timeout=180)
    installed = False
    try:
        subprocess.run(["xcrun", "simctl", "install", device, str(directory / "build/Build/Products/Debug-iphonesimulator/MemoCard.app")], check=True, timeout=60)
        installed = True
        launch = subprocess.run(["xcrun", "simctl", "launch", "--console", device, "dev.divikwu.memocard.surface-probe"], check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=60)
        print(launch.stdout)
        marker = "SURFACE_SUBSCRIPTION_RESULT "
        result = next((json.loads(line.removeprefix(marker)) for line in launch.stdout.splitlines() if line.startswith(marker)), None)
        if result is None:
            raise RuntimeError("Surface probe exited without completing its assertions")
        (directory / "result.json").write_text(json.dumps(result, indent=2) + "\n")
        if args.output_dir:
            print(f"Native surface evidence: {directory}")
        else:
            print("Native surface assertions passed")
    finally:
        if installed:
            subprocess.run(["xcrun", "simctl", "uninstall", device, "dev.divikwu.memocard.surface-probe"], check=True, timeout=60)

device, created_device = select_device()
try:
    if args.output_dir:
        directory = args.output_dir.resolve()
        directory.mkdir(parents=True, exist_ok=False)
        run(directory)
    else:
        with tempfile.TemporaryDirectory(prefix="memocard-surfaces-") as temporary:
            run(Path(temporary))
finally:
    if created_device:
        subprocess.run(["xcrun", "simctl", "shutdown", device], check=False)
        subprocess.run(["xcrun", "simctl", "delete", device], check=True)
