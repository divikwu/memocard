import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("surface_environment", Path(__file__).with_name("run-surface-subscriptions.py"))
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


class EnvironmentTests(unittest.TestCase):
    def test_single_boot_spans_build_install_assertions_and_cleanup(self):
        # Exercise the orchestration, without invoking Xcode or a real simulator.
        for failed_phase in (None, "bootstatus", "build", "install"):
            with self.subTest(failed_phase=failed_phase), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                sources = root / "input"
                sources.mkdir()
                (sources / "App.swift").write_text("// fixture")
                tests = root / "apps/apple/Tests"
                tests.mkdir(parents=True)
                (tests / "NativeSurfaceSubscriptionHarness.swift").write_text("// harness")
                schemes = root / "apps/apple/MemoCard.xcodeproj/xcshareddata/xcschemes"
                schemes.mkdir(parents=True)
                (schemes / "MemoCardiOS.xcscheme").write_text("<Scheme/>")
                output = root / "output"
                output.mkdir()
                calls = []

                def command(name, *args, **kwargs):
                    calls.append(name)
                    if name == failed_phase:
                        raise RuntimeError(name)
                    return '{"objects": {}}' if name == "project-read" else ""

                def launch(directory):
                    calls.append("assertions")
                    return 'SURFACE_SUBSCRIPTION_RESULT {"passed": true}\n'

                with patch.object(probe, "root", root), patch.object(probe, "args", SimpleNamespace(source_dir=sources, baseline=False, output_dir=output)), patch.object(probe, "device", "device"), patch.object(probe, "runtime", "runtime", create=True), patch.object(probe, "phase", side_effect=command), patch.object(probe, "launch_probe", side_effect=launch):
                    if failed_phase:
                        with self.assertRaisesRegex(RuntimeError, failed_phase):
                            probe.run(output)
                        expected = ["project-read", "runtime-cache", "bootstatus", "build", "install"]
                        self.assertEqual(calls, expected[:expected.index(failed_phase) + 1])
                    else:
                        probe.run(output)
                        self.assertEqual(calls, ["project-read", "runtime-cache", "bootstatus", "build", "install", "assertions", "uninstall"])
                        self.assertEqual(json.loads((output / "result.json").read_text()), {"passed": True})

    def test_discovery_creation_inventory_and_project_read_have_deadlines(self):
        runtimes = {"runtimes": [{"isAvailable": True, "identifier": "com.apple.iOS-27", "version": "27.0", "supportedDeviceTypes": [{"productFamily": "iPhone", "identifier": "phone"}]}]}
        inventory = {"devices": {"com.apple.iOS-27": [{"udid": "created-device", "dataPath": "/tmp/device"}]}}
        calls = []

        def command(name, argv, timeout, capture=False):
            calls.append((name, timeout, capture))
            if name == "list-runtimes":
                return json.dumps(runtimes)
            if name == "list-devices":
                return '{"devices": {}}'
            if name == "create-device":
                return "created-device\n"
            if name == "device-inventory":
                return json.dumps(inventory)
            return ""

        with patch.object(sys, "argv", ["probe", "--prepare-only"]), patch.object(probe, "phase", side_effect=command), patch.object(probe.subprocess, "check_output", side_effect=AssertionError("unbounded check_output")), patch.object(probe.subprocess, "run", side_effect=AssertionError("unlogged run")):
            probe.main()
        self.assertEqual(calls, [("list-runtimes", 180, True), ("list-devices", 30, True), ("create-device", 60, True), ("device-inventory", 30, True), ("runtime-cache", 600, False), ("bootstatus", 180, False), ("cleanup-shutdown", 30, False), ("cleanup-delete", 30, False)])
        # Exercise the real project reader call site, without building an App.
        import tempfile
        with tempfile.TemporaryDirectory() as temporary, patch.object(probe, "args", SimpleNamespace(source_dir=Path(temporary) / "input", baseline=False)), patch.object(probe, "phase", side_effect=RuntimeError("project-read reached")) as phase:
            with self.assertRaisesRegex(RuntimeError, "project-read reached"):
                (Path(temporary) / "input").mkdir()
                (Path(temporary) / "output").mkdir()
                probe.run(Path(temporary) / "output")
            self.assertEqual(phase.call_args.args[0], "project-read")
            self.assertEqual(phase.call_args.args[2], 30)

    def test_timeout_kills_once_retains_output_and_emits_bounded_diagnostics(self):
        process = Mock(pid=42, returncode=-9)
        process.communicate.side_effect = [subprocess.TimeoutExpired(["xcrun"], 30, output=b"partial inventory"), ("", None)]
        output = io.StringIO()
        with patch.object(probe.subprocess, "Popen", return_value=process), patch.object(probe, "diagnostic") as diagnostic, contextlib.redirect_stdout(output):
            with self.assertRaises(subprocess.TimeoutExpired):
                probe.phase("list-runtimes", ["xcrun"], 30, capture=True)
        process.kill.assert_called_once()
        self.assertEqual(process.communicate.call_count, 2)
        self.assertEqual(diagnostic.call_args_list[0].args, ("list-runtimes-sample", ["sample", "42", "1"], 5))
        self.assertTrue(all(call.args[2] <= 10 for call in diagnostic.call_args_list))
        self.assertIn("partial inventory", output.getvalue())
        self.assertIn('"outcome": "timeout"', output.getvalue())
        self.assertIn('"event": "finish"', output.getvalue())

    def test_metadata_json_is_not_polluted_by_stderr_warnings(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            result = probe.phase("project-read", [sys.executable, "-c", '''import sys; print('{"objects": {}}'); print("metadata warning", file=sys.stderr)'''], 30, capture=True)
        self.assertEqual(json.loads(result), {"objects": {}})
        self.assertIn("metadata warning", output.getvalue())

    def test_nonzero_exit_and_missing_executable_fail_with_context(self):
        for error in (None, FileNotFoundError("xcrun absent")):
            process = Mock(returncode=2)
            process.communicate.return_value = ("bad inventory", None)
            output = io.StringIO()
            with self.subTest(error=error), patch.object(probe.subprocess, "Popen", return_value=process, side_effect=error), patch.object(probe, "diagnostic"), contextlib.redirect_stdout(output):
                with self.assertRaises((subprocess.CalledProcessError, FileNotFoundError)):
                    probe.phase("device-inventory", ["xcrun"], 30, capture=True)
                self.assertIn('"event": "finish"', output.getvalue())
                self.assertIn('"outcome": "failed"', output.getvalue())

    def test_cleanup_failure_does_not_replace_original_inventory_failure(self):
        calls = []

        def phase(name, *args, **kwargs):
            calls.append(name)
            raise RuntimeError(name)

        with patch.object(sys, "argv", ["probe", "--prepare-only"]), patch.object(probe, "select_device", return_value=("device", True)), patch.object(probe, "phase", side_effect=phase):
            with self.assertRaisesRegex(RuntimeError, "device-inventory"):
                probe.main()
        self.assertEqual(calls, ["device-inventory", "cleanup-shutdown", "cleanup-delete"])


if __name__ == "__main__":
    unittest.main()
