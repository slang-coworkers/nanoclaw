#!/usr/bin/env python3
"""Tests for collect_threads.py. A fake `ncl` (a Python script written to a
temp dir) serves canned frames keyed by argv, so the collector runs offline.
Run: python3 -m unittest discover -s ops/nemoclaw-coworkers/autopilot -p 'test_*.py'
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPT = str(HERE / "collect_threads.py")
NOW = "2026-09-09T12:00:00Z"

GROUPS = [
    {"id": "ag-orch", "name": "Orchestrator", "folder": "orchestrator"},
    {"id": "ag-arch", "name": "hermes-architect", "folder": "hermes-architect"},
    {"id": "ag-build", "name": "hermes-builder", "folder": "hermes-builder"},
    {"id": "ag-test", "name": "hermes-tester", "folder": "hermes-tester"},
    {"id": "ag-rev", "name": "hermes-reviewer", "folder": "hermes-reviewer"},
    {"id": "ag-other", "name": "slang-fixer", "folder": "slang-fixer"},
]

SESSIONS = [
    {"id": "s-arch-f35", "agent_group_id": "ag-arch", "thread_id": "hermes-LOOP-F35", "status": "active",
     "container_status": "running", "last_active": "2026-09-09T11:50:00Z"},
    {"id": "s-orch-f35", "agent_group_id": "ag-orch", "thread_id": "hermes-LOOP-F35", "status": "active",
     "container_status": "stopped", "last_active": "2026-09-09T10:00:00Z"},
    {"id": "s-orch-p0", "agent_group_id": "ag-orch", "thread_id": "hermes-P0-LOOP", "status": "active",
     "container_status": "stopped", "last_active": "2026-09-09T06:00:00Z"},
    {"id": "s-build-nothread", "agent_group_id": "ag-build", "thread_id": None, "status": "active",
     "container_status": "stopped", "last_active": "2026-09-09T09:00:00Z"},
    {"id": "s-closed", "agent_group_id": "ag-test", "thread_id": "hermes-LOOP-F35", "status": "closed",
     "container_status": "stopped", "last_active": "2026-09-01T00:00:00Z"},
    {"id": "s-foreign", "agent_group_id": "ag-other", "thread_id": "hermes-LOOP-F35", "status": "active",
     "container_status": "running", "last_active": "2026-09-09T11:00:00Z"},
]

MESSAGES = {
    "s-arch-f35": [
        {"seq": 1, "direction": "in", "kind": "chat", "timestamp": "2026-09-09T06:50:00Z", "sender": "orchestrator",
         "text": "Dispatch LOOP-F35: Lego coworker composition."},
        {"seq": 3, "direction": "out", "kind": "chat", "timestamp": "2026-09-09 09:57:00", "sender": "hermes-architect",
         "text": "[Spec handoff] LOOP-F35: Lego coworker composition\n- **CORE-CHANGE:** none"},
    ],
    "s-orch-f35": [
        {"seq": 2, "direction": "out", "kind": "chat", "timestamp": "2026-09-09 06:50:00", "sender": "orchestrator",
         "text": "Dispatch LOOP-F35: Lego coworker composition."},
    ],
    "s-build-nothread": [
        {"seq": 5, "direction": "in", "kind": "chat", "timestamp": "2026-09-09T10:10:00Z", "sender": "hermes-architect",
         "text": "Spec handoff LOOP-F35: Lego coworker composition\nPriority: P0"},
    ],
}

COST = {"s-arch-f35": "ok", "s-orch-f35": "unknown", "s-build-nothread": "stopped"}

FAKE_NCL = r'''#!/usr/bin/env python3
import json, sys
args = sys.argv[1:]
fixtures = json.load(open(sys.argv[0] + ".fixtures.json"))
if args[:2] == ["sessions", "messages"]:
    sid = args[2]
    if fixtures.get("sleep_s"):
        import time; time.sleep(fixtures["sleep_s"])
    if sid in fixtures["fail_messages"]:
        sys.stderr.write("session not found: " + sid); sys.exit(1)
    print(json.dumps({"id": "x", "ok": True, "data": fixtures["messages"].get(sid, [])})); sys.exit(0)
if args[:2] == ["cost-cap", "status"]:
    sid = args[args.index("--session") + 1]
    if sid in fixtures["fail_cost"]:
        print(json.dumps({"id": "x", "ok": False, "error": {"code": "E", "message": "no cost row"}})); sys.exit(0)
    print(json.dumps({"id": "x", "ok": True, "data": {"session_id": sid, "status": fixtures["cost"].get(sid, "unknown")}})); sys.exit(0)
sys.stderr.write("unexpected: " + " ".join(args)); sys.exit(2)
'''


class CollectThreadsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.ncl = self.dir / "ncl"
        self.ncl.write_text(FAKE_NCL)
        os.chmod(self.ncl, 0o755)
        self.fixtures = {"messages": MESSAGES, "cost": COST, "fail_messages": [], "fail_cost": []}
        (self.dir / "groups.json").write_text(json.dumps({"id": "g", "ok": True, "data": GROUPS}))
        (self.dir / "sessions.json").write_text(json.dumps(SESSIONS))

    def tearDown(self):
        self.tmp.cleanup()

    def run_collect(self, *extra):
        (self.dir / "ncl.fixtures.json").write_text(json.dumps(self.fixtures))
        proc = subprocess.run(
            [sys.executable, SCRIPT, "--groups", str(self.dir / "groups.json"), "--sessions", str(self.dir / "sessions.json"),
             "--ncl", str(self.ncl), "--now", NOW, *extra],
            capture_output=True, text=True, check=False,
        )
        self.assertEqual(proc.returncode, 0, proc.stderr)
        return json.loads(proc.stdout)

    def test_roles_resolved_by_folder(self):
        out = self.run_collect()
        self.assertEqual(out["roles"]["hermes-architect"], "ag-arch")
        self.assertEqual(out["roles"]["orchestrator"], "ag-orch")
        self.assertNotIn("slang-fixer", out["roles"])

    def test_threaded_sessions_grouped_by_row_and_foreign_groups_ignored(self):
        out = self.run_collect()
        f35 = out["threads"]["LOOP-F35"]
        self.assertEqual(f35["thread_id"], "hermes-LOOP-F35")
        ids = {s["id"] for s in f35["sessions"]}
        self.assertIn("s-arch-f35", ids)
        self.assertIn("s-orch-f35", ids)
        self.assertNotIn("s-foreign", ids, "a non-role group on the thread is not chain activity")
        self.assertNotIn("s-closed", ids, "closed sessions are not read")

    def test_non_row_threads_counted_not_read(self):
        out = self.run_collect()
        self.assertIn("hermes-P0-LOOP", out["other_threads"])
        self.assertNotIn("P0-LOOP", out["threads"])

    def test_messages_and_cost_status_stamped(self):
        out = self.run_collect()
        arch = next(s for s in out["threads"]["LOOP-F35"]["sessions"] if s["id"] == "s-arch-f35")
        self.assertEqual(arch["role"], "hermes-architect")
        self.assertEqual(arch["cost_status"], "ok")
        self.assertEqual(arch["messages"][1]["text"].split("\n")[0], "[Spec handoff] LOOP-F35: Lego coworker composition")
        self.assertEqual(arch["messages"][1]["direction"], "out")

    def test_fallback_scan_attributes_unthreaded_role_by_mention(self):
        out = self.run_collect()
        build = [s for s in out["threads"]["LOOP-F35"]["sessions"] if s["role"] == "hermes-builder"]
        self.assertEqual(len(build), 1)
        self.assertTrue(build[0]["inferred"])
        self.assertEqual(build[0]["cost_status"], "stopped")

    def test_fallback_scan_disabled(self):
        out = self.run_collect("--scan-fallback", "0")
        self.assertFalse([s for s in out["threads"]["LOOP-F35"]["sessions"] if s["role"] == "hermes-builder"])

    def test_read_failure_recorded_not_dropped(self):
        self.fixtures["fail_messages"] = ["s-arch-f35"]
        self.fixtures["fail_cost"] = ["s-orch-f35"]
        out = self.run_collect()
        sources = [e["source"] for e in out["collector_errors"]]
        self.assertIn("ncl sessions messages s-arch-f35", sources)
        self.assertIn("ncl cost-cap status --session s-orch-f35", sources)
        arch = next(s for s in out["threads"]["LOOP-F35"]["sessions"] if s["id"] == "s-arch-f35")
        self.assertEqual(arch["messages"], [])
        self.assertIn("messages_error", arch)
        self.assertTrue(out["sessions_checked"])

    def test_max_sessions_cap_is_reported(self):
        out = self.run_collect("--max-sessions", "1")
        self.assertEqual(out["counts"]["sessions_read"], 1)
        self.assertTrue(any("max-sessions" in e["error"] for e in out["collector_errors"]))

    def test_missing_session_list_degrades(self):
        (self.dir / "sessions.json").write_text("not json")
        out = self.run_collect()
        self.assertFalse(out["sessions_checked"])
        self.assertEqual(out["threads"], {})
        self.assertEqual(out["collector_errors"][-1]["source"], "ncl sessions list")

    def test_rows_filter_lists_but_does_not_read_other_threads(self):
        out = self.run_collect("--rows", "MEM-F44", "--scan-fallback", "0")
        f35 = out["threads"]["LOOP-F35"]["sessions"]
        self.assertEqual({s["id"] for s in f35}, {"s-arch-f35", "s-orch-f35"})
        self.assertTrue(all(s["messages_error"] == "not read: row not in flight" and s["messages"] == [] for s in f35))
        self.assertEqual(out["counts"]["sessions_read"], 0)
        self.assertEqual(out["counts"]["sessions_unread"], 2)
        self.assertEqual(out["filter"], {"rows": ["MEM-F44"], "deadline_s": 0.0})

    def test_rows_filter_reads_the_named_row(self):
        out = self.run_collect("--rows", "LOOP-F35,MEM-F44", "--scan-fallback", "0")
        arch = next(s for s in out["threads"]["LOOP-F35"]["sessions"] if s["id"] == "s-arch-f35")
        self.assertEqual(len(arch["messages"]), 2)
        self.assertNotIn("messages_error", arch)

    def test_empty_rows_filter_reads_nothing(self):
        out = self.run_collect("--rows", "", "--scan-fallback", "0")
        self.assertEqual(out["counts"]["sessions_read"], 0)
        self.assertEqual(out["filter"]["rows"], [])

    def test_deadline_leaves_remaining_sessions_unread_and_says_so(self):
        self.fixtures["sleep_s"] = 0.6
        out = self.run_collect("--deadline-s", "0.2", "--scan-fallback", "0")
        sess = out["threads"]["LOOP-F35"]["sessions"]
        read = [s for s in sess if "messages_error" not in s]
        unread = [s for s in sess if s.get("messages_error", "").startswith("not read: deadline")]
        self.assertEqual((len(read), len(unread)), (1, 1))
        self.assertTrue(any("deadline 0.2s reached; 1 sessions not read" in e["error"] for e in out["collector_errors"]))
        self.assertEqual(out["counts"]["sessions_unread"], 1)

    def test_max_sessions_cap_marks_the_session_unread(self):
        out = self.run_collect("--max-sessions", "1", "--scan-fallback", "0")
        sess = out["threads"]["LOOP-F35"]["sessions"]
        self.assertEqual(sum(1 for s in sess if s.get("messages_error", "").startswith("not read: max-sessions")), 1)

    def test_missing_role_group_is_an_error_line(self):
        (self.dir / "groups.json").write_text(json.dumps([g for g in GROUPS if g["folder"] != "hermes-reviewer"]))
        out = self.run_collect()
        self.assertTrue(any("hermes-reviewer" in e["error"] for e in out["collector_errors"]))


if __name__ == "__main__":
    unittest.main()
