import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("surface_environment", Path(__file__).with_name("run-surface-subscriptions.py"))
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


class EnvironmentTests(unittest.TestCase):
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
        self.assertEqual(calls, [("list-runtimes", 30, True), ("list-devices", 30, True), ("create-device", 60, True), ("device-inventory", 30, True), ("runtime-cache", 600, False), ("bootstatus", 180, False), ("cleanup-shutdown", 30, False), ("cleanup-delete", 30, False)])
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
        self.assertTrue(diagnostic.called)
        self.assertTrue(all(call.args[2] <= 10 for call in diagnostic.call_args_list))
        self.assertIn("partial inventory", output.getvalue())
        self.assertIn('"outcome": "timeout"', output.getvalue())
        self.assertIn('"event": "finish"', output.getvalue())

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
