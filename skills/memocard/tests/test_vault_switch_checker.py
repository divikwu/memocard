"""Regression checks for the simulated-decision checker; no live MCP access."""

import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parent


class CheckerTests(unittest.TestCase):
    def setUp(self):
        self.results = json.loads((ROOT / "vault-switch-results.json").read_text())

    def check_results(self, results):
        with tempfile.TemporaryDirectory(prefix="memocard-skill-regression-") as directory:
            path = Path(directory) / "results.json"
            path.write_text(json.dumps(results))
            return subprocess.run(
                [sys.executable, str(ROOT / "check_vault_switch_results.py"), str(path)],
                capture_output=True, text=True,
            )

    def case(self, case_id):
        return next(case for case in self.results["cases"] if case["id"] == case_id)

    def test_recorded_decisions_pass(self):
        result = self.check_results(self.results)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_rejects_cross_vault_writes_with_short_and_full_names(self):
        for prefix in ("", "mcp__memocard__"):
            for tool in ("create_note", "update_note", "delete_note", "restore_note"):
                with self.subTest(tool=prefix + tool):
                    results = copy.deepcopy(self.results)
                    case = next(c for c in results["cases"] if c["id"] == "search-then-other-vault")
                    args = {"binding": {"vaultId": "vault-b", "instanceId": "instance-b"},
                            "id": "d9a9d5ec-1c9b-40ae-8a61-a1cc7d7baf81", "body": "新增结论"}
                    if tool == "update_note":
                        args["baseHash"] = "a" * 64
                    case["nextCalls"] = [{"tool": prefix + tool, "arguments": args}]
                    self.assertNotEqual(self.check_results(results).returncode, 0)

    def test_accepts_full_names_for_valid_reads_and_writes(self):
        for case in self.results["cases"]:
            for call in case["nextCalls"]:
                if not call["tool"].startswith("mcp__memocard__"):
                    call["tool"] = "mcp__memocard__" + call["tool"]
        result = self.check_results(self.results)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_rejects_unknown_tools(self):
        for tool in ("mcp__other__update_note", "mcp__memocard__permanently_delete_note", "exec", "typo"):
            with self.subTest(tool=tool):
                self.case("search-then-other-vault")["nextCalls"] = [{"tool": tool, "arguments": {}}]
                self.assertNotEqual(self.check_results(self.results).returncode, 0)

    def test_recovery_cannot_write_before_fresh_read(self):
        self.case("restored-vault-awaiting-read")["nextCalls"] = copy.deepcopy(
            self.case("restored-vault-fresh-append")["nextCalls"])
        self.assertNotEqual(self.check_results(self.results).returncode, 0)

    def test_recovery_cannot_reuse_old_binding_hash_or_body(self):
        for field, value in (
            ("binding", {"vaultId": "vault-a", "instanceId": "instance-a"}),
            ("baseHash", "a" * 64),
            ("body", "原记录\n\n新增结论"),
        ):
            with self.subTest(field=field):
                results = copy.deepcopy(self.results)
                case = next(c for c in results["cases"] if c["id"] == "restored-vault-fresh-append")
                case["nextCalls"][0]["arguments"][field] = value
                self.assertNotEqual(self.check_results(results).returncode, 0)

    def test_recovery_cannot_skip_readback(self):
        self.case("restored-vault-awaiting-readback")["verification"] = "verified"
        self.assertNotEqual(self.check_results(self.results).returncode, 0)

    def test_recovery_cannot_write_after_another_switch(self):
        self.case("restored-vault-changed-again")["nextCalls"] = copy.deepcopy(
            self.case("restored-vault-fresh-append")["nextCalls"])
        self.assertNotEqual(self.check_results(self.results).returncode, 0)

    def test_recovery_must_complete_instead_of_stopping_forever(self):
        self.case("restored-vault-fresh-append")["nextCalls"] = []
        self.assertNotEqual(self.check_results(self.results).returncode, 0)
        self.results = json.loads((ROOT / "vault-switch-results.json").read_text())
        self.case("restored-vault-verified")["verification"] = "unverified"
        self.assertNotEqual(self.check_results(self.results).returncode, 0)

    def test_background_service_must_proceed_when_main_client_is_closed(self):
        self.case("service-host-client-closed")["nextCalls"] = []
        self.assertNotEqual(self.check_results(self.results).returncode, 0)

    def test_delete_and_restore_need_the_latest_read_binding_and_version(self):
        for case_id in ("stable-delete", "stable-restore", "restored-service-fresh-restore"):
            for field, value in (("binding", {"vaultId": "other", "instanceId": "other"}),
                                 ("baseHash", "stale-version")):
                with self.subTest(case=case_id, field=field):
                    results = copy.deepcopy(self.results)
                    case = next(c for c in results["cases"] if c["id"] == case_id)
                    case["nextCalls"][0]["arguments"][field] = value
                    self.assertNotEqual(self.check_results(results).returncode, 0)

    def test_restore_cannot_write_using_list_preview_or_pre_restart_archive(self):
        for case_id in ("restore-list-requires-read", "restored-service-awaiting-archive"):
            self.case(case_id)["nextCalls"] = copy.deepcopy(self.case("stable-restore")["nextCalls"])
            self.assertNotEqual(self.check_results(self.results).returncode, 0)

    def test_delete_restore_receipts_are_not_verification(self):
        for case_id in ("delete-receipt-awaiting-verification", "restore-receipt-awaiting-verification",
                        "restore-incomplete-trash", "delete-timeout-reconcile"):
            self.case(case_id)["verification"] = "verified"
            self.assertNotEqual(self.check_results(self.results).returncode, 0)

    def test_delete_absence_needs_a_post_error_binding_check(self):
        self.case("delete-receipt-awaiting-verification")["nextCalls"].pop()
        self.assertNotEqual(self.check_results(self.results).returncode, 0)
        for case_id in ("delete-readback-awaiting-status", "delete-readback-other-instance"):
            self.case(case_id)["verification"] = "verified"
            self.assertNotEqual(self.check_results(self.results).returncode, 0)


if __name__ == "__main__":
    unittest.main()
