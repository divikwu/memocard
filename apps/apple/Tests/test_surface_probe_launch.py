import contextlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("surface_probe", Path(__file__).with_name("run-surface-subscriptions.py"))
probe = importlib.util.module_from_spec(spec)
spec.loader.exec_module(probe)


class LaunchProtocolTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.directory = Path(temporary.name)
        self.data = self.directory / "device"
        (self.data / "tmp").mkdir(parents=True)
        self.now = 0
        self.spawn_delay = 1
        self.assertion_seconds = "1"
        self.completion = "true"
        self.emit = True
        self.result = json.dumps({"measurement": "native-surface-subscriptions"})
        self.calls = []
        patches = contextlib.ExitStack()
        self.addCleanup(patches.close)
        patches.enter_context(patch.object(probe, "device", "test-device", create=True))
        patches.enter_context(patch.object(probe, "device_data_path", self.data, create=True))
        patches.enter_context(patch.object(probe, "time", SimpleNamespace(monotonic=lambda: self.now, sleep=self.advance)))
        patches.enter_context(patch.object(probe, "phase", self.spawn))

    def advance(self, seconds):
        self.now += seconds

    def spawn(self, name, command, timeout, capture=False):
        self.calls.append((name, timeout))
        if self.spawn_delay > timeout:
            self.advance(timeout)
            raise subprocess.TimeoutExpired(command, timeout)
        self.advance(self.spawn_delay)
        if self.emit:
            relative = next(argument.split("=", 1)[1] for argument in command if argument.startswith("--stdout="))
            output = ["NATIVE_SURFACE_PROBE_STAGE app-task-start", f"SURFACE_SUBSCRIPTION_RESULT {self.result}"]
            if self.assertion_seconds is not None:
                output.append(f"NATIVE_SURFACE_PROBE_TIMING assertionSeconds={self.assertion_seconds}")
            output.append(f"NATIVE_SURFACE_PROBE_STAGE app-task-complete passed={self.completion}")
            (self.data / relative.lstrip("/")).write_text("\n".join(output) + "\n")
        return "dev.divikwu.memocard.surface-probe: 42\n"

    def test_slow_environment_spawn_does_not_consume_assertion_budget(self):
        self.spawn_delay = 70
        self.assertIn("passed=true", probe.launch_probe(self.directory))
        self.assertEqual(self.calls, [("spawn", 180)])

    def test_spawn_still_has_a_hard_deadline_without_retry(self):
        self.spawn_delay = 181
        with self.assertRaises(subprocess.TimeoutExpired):
            probe.launch_probe(self.directory)
        self.assertEqual(self.calls, [("spawn", 180)])

    def test_missing_completion_still_expires_after_sixty_seconds(self):
        self.emit = False
        with self.assertRaises(subprocess.TimeoutExpired):
            probe.launch_probe(self.directory)
        self.assertAlmostEqual(self.now, self.spawn_delay + 60)

    def test_native_timing_cannot_hide_slow_assertions_during_spawn(self):
        self.spawn_delay = 70
        self.assertion_seconds = "61"
        with self.assertRaisesRegex(RuntimeError, "assertion.*60"):
            probe.launch_probe(self.directory)

    def test_timing_is_required_finite_and_nonnegative(self):
        for timing in (None, "nan", "inf", "-1", "invalid"):
            with self.subTest(timing=timing):
                self.assertion_seconds = timing
                with self.assertRaises(RuntimeError):
                    probe.launch_probe(self.directory)

    def test_assertion_budget_includes_zero_and_sixty_seconds(self):
        for timing in ("0", "60"):
            with self.subTest(timing=timing):
                self.assertion_seconds = timing
                self.assertIn("passed=true", probe.launch_probe(self.directory))

    def test_false_completion_and_malformed_result_still_fail(self):
        self.completion = "false"
        with self.assertRaisesRegex(RuntimeError, "assertions failed"):
            probe.launch_probe(self.directory)
        self.completion = "true"
        self.result = "invalid"
        with self.assertRaises(ValueError):
            probe.launch_probe(self.directory)


if __name__ == "__main__":
    unittest.main()
