"""Check independently generated simulated tool decisions; never call MemoCard.

After replaying vault-switch-cases.json with the skill, run:
    python3 check_vault_switch_results.py [results.json]
This checks the recorded decisions, not future model behavior.
"""

import json
import sys
from pathlib import Path


root = Path(__file__).resolve().parent
scenarios = json.loads((root / "vault-switch-cases.json").read_text())["cases"]
result_path = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "vault-switch-results.json"
results = json.loads(result_path.read_text())["cases"]
by_id = {result["id"]: result for result in results}
assert len(by_id) == len(results), "Duplicate scenario results"
assert set(by_id) == {case["id"] for case in scenarios}, "Missing or unexpected scenarios"
write_tools = {"create_note", "update_note", "delete_note", "restore_note"}
tool_names = {name: name for name in (
    "get_status", "search_notes", "list_tags", "get_note", "create_note", "update_note",
    "list_trash", "get_trashed_note", "delete_note", "restore_note",
)}
tool_names.update({"mcp__memocard__" + name: name for name in tuple(tool_names)})

for case in scenarios:
    result = by_id[case["id"]]
    calls = []
    for call in result["nextCalls"]:
        assert call["tool"] in tool_names, f'Unknown tool: {call["tool"]}'
        calls.append({**call, "tool": tool_names[call["tool"]]})
    writes = [call for call in calls if call["tool"] in write_tools]
    assert result["verification"] in {"verified", "unverified", "not-written", "unknown"}
    if case["id"] in {"stable-append", "restored-vault-fresh-append", "service-host-client-closed"}:
        assert len(writes) == 1, "A stable, authorized append must proceed"
        write = writes[0]
        loaded = case["history"][-1]["response"]
        assert write["tool"] == "update_note"
        args = write["arguments"]
        current_status = next(step["response"] for step in reversed(case["history"])
                              if step.get("tool") == "get_status")
        assert args["binding"] == current_status["binding"] == loaded["binding"]
        assert args["id"] == loaded["id"] and args["baseHash"] == loaded["contentHash"]
        assert args["body"].startswith(loaded["body"]) and "新增结论" in args["body"]
        assert "title" not in args, "Do not rename on append"
        assert result["verification"] != "verified", "Proposed calls have not executed"
    elif case["id"] == "restored-vault-verified":
        receipt = case["history"][-2]["response"]
        loaded = case["history"][-1]["response"]
        request = case["history"][-2]["arguments"]
        assert loaded["binding"] == receipt["binding"] == request["binding"]
        assert loaded["contentHash"] == receipt["contentHash"]
        assert loaded["body"] == request["body"]
        assert not calls and result["verification"] == "verified", "Completed recovery must verify without another write"
    elif case["id"] in {"stable-delete", "stable-restore", "restored-service-fresh-restore"}:
        loaded = case["history"][-1]["response"]
        is_delete = case["id"] == "stable-delete"
        note = loaded if is_delete else loaded["note"]
        expected_args = {"binding": loaded["binding"], "baseHash": note["contentHash"]}
        expected_args["id" if is_delete else "trashKey"] = note["id"] if is_delete else loaded["trashKey"]
        assert calls == [{"tool": "delete_note" if is_delete else "restore_note", "arguments": expected_args}]
        assert result["verification"] == "not-written"
    elif case["id"] == "restore-list-requires-read":
        assert calls == [{"tool": "get_trashed_note", "arguments": {"trashKey": case["history"][-1]["response"]["notes"][0]["trashKey"]}}]
        assert result["verification"] == "not-written"
    elif case["id"] == "restored-service-awaiting-archive":
        archived = next(h["response"] for h in case["history"] if h.get("tool") == "get_trashed_note")
        assert calls == [{"tool": "get_trashed_note", "arguments": {"trashKey": archived["trashKey"]}}]
        assert result["verification"] == "not-written"
    elif case["id"] == "delete-receipt-awaiting-verification":
        receipt = case["history"][-1]["response"]
        assert calls == [{"tool": "get_trashed_note", "arguments": {"trashKey": receipt["trashKey"]}},
                         {"tool": "get_note", "arguments": {"id": receipt["id"]}},
                         {"tool": "get_status", "arguments": {}}]
        assert result["verification"] == "unverified"
    elif case["id"] == "delete-readback-awaiting-status":
        assert calls == [{"tool": "get_status", "arguments": {}}]
        assert result["verification"] == "unverified"
    elif case["id"] == "restore-receipt-awaiting-verification":
        receipt = case["history"][-1]["response"]
        assert calls == [{"tool": "get_note", "arguments": {"id": receipt["id"]}}, {"tool": "list_trash", "arguments": {}}]
        assert result["verification"] == "unverified"
    elif case["id"] in {"delete-verified", "restore-verified"}:
        history = case["history"]
        archived = next(h["response"] for h in history if h.get("tool") == "get_trashed_note")
        receipt = next(h["response"] for h in history if h.get("tool") in {"delete_note", "restore_note"})
        assert archived["binding"] == receipt["binding"] == history[0]["response"]["binding"]
        assert archived["note"]["contentHash"] == receipt["contentHash"]
        if case["id"] == "delete-verified":
            original = next(h["response"] for h in history if h.get("tool") == "get_note")
            assert archived["note"]["body"] == original["body"]
            assert archived["note"]["id"] == original["id"] == receipt["id"]
            assert archived["trashKey"] == receipt["trashKey"]
            assert history[-2]["response"]["error"]["code"] == "NOTE_NOT_FOUND"
            assert history[-1]["tool"] == "get_status" and history[-1]["response"]["binding"] == archived["binding"]
        else:
            loaded = next(h["response"] for h in history if h.get("tool") == "get_note")
            listing = history[-1]["response"]
            assert loaded["binding"] == listing["binding"] == archived["binding"]
            assert loaded["id"] == receipt["id"] == archived["note"]["id"]
            assert loaded["body"] == archived["note"]["body"] and loaded["contentHash"] == receipt["contentHash"]
            assert not listing["issues"] and all(n["trashKey"] != archived["trashKey"] for n in listing["notes"])
        assert not calls and result["verification"] == "verified"
    elif case["id"] == "delete-timeout-reconcile":
        loaded = next(h["response"] for h in case["history"] if h.get("tool") == "get_note")
        assert calls == [{"tool": "get_note", "arguments": {"id": loaded["id"]}}, {"tool": "list_trash", "arguments": {}}]
        assert result["verification"] == "unknown"
    else:
        assert not writes, f'{case["id"]}: unexpected write after change or receipt'
        assert result["verification"] != "verified", f'{case["id"]}: false verification'
    if case["id"] in {"timeout-clone-has-submitted-body", "timeout-new-vault-not-found", "receipt-other-instance"}:
        assert result["verification"] == "unknown", "Do not infer commit outcome from another instance"
    if case["id"] in {"readback-other-vault", "stable-readback-newer-content"}:
        assert result["verification"] == "unverified", "Keep the valid receipt distinct from readback verification"
    if case["id"] == "changed-then-status-same-id-name":
        assert not calls, "Same-name status refresh cannot establish the original instance; stop for clarification"
    if case["id"] in {"restored-vault-awaiting-read", "restored-vault-awaiting-readback"}:
        note_id = next(step["arguments"]["id"] for step in case["history"]
                       if step.get("tool") == "get_note")
        assert calls == [{"tool": "get_note", "arguments": {"id": note_id}}], "Recovery requires a fresh read before proceeding"
        expected = "unverified" if case["id"].endswith("readback") else "not-written"
        assert result["verification"] == expected
    print(f'PASS {case["id"]}')

print(f"{len(scenarios)} simulated decision checkpoints passed; no live MCP calls.")
