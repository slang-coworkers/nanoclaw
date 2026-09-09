#!/usr/bin/env python3
"""Offline end-to-end run of pull-state.sh: fake `ncl` and `gh` on PATH, the repo's plan and
matrix, the fixture ledger (P0-LOOP merged, LOOP-F35 at spec handoff). Pins the three
adaptations the script owns: the queue runs before the collector and hands it the in-flight
rows; a thread with an unread session is null for the supervisor (no action on partial
evidence); an architect session already sitting on a row thread marks that row dispatched
(never dispatch twice). Also runs gate-supervise.sh end to end. Skipped when bash is unavailable.
Run: python3 -m unittest discover -s ops/nemoclaw-coworkers/autopilot -p 'test_*.py'
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
DOCS = HERE.parents[2] / "docs" / "hermes-port"
NOW = "2026-09-09T21:00:00Z"
HEAD = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678"

GROUPS = [
    {"id": "ag-orch", "name": "Orchestrator", "folder": "orchestrator"},
    {"id": "ag-arch", "name": "hermes-architect", "folder": "hermes-architect"},
    {"id": "ag-build", "name": "hermes-builder", "folder": "hermes-builder"},
    {"id": "ag-test", "name": "hermes-tester", "folder": "hermes-tester"},
    {"id": "ag-rev", "name": "hermes-reviewer", "folder": "hermes-reviewer"},
]

SESSIONS = [
    {"id": "s-arch-f35", "agent_group_id": "ag-arch", "thread_id": "hermes-LOOP-F35", "status": "active",
     "container_status": "stopped", "last_active": "2026-09-09T10:00:00Z", "created_at": "2026-09-09T06:50:00Z"},
    {"id": "s-build-f35", "agent_group_id": "ag-build", "thread_id": "hermes-LOOP-F35", "status": "active",
     "container_status": "running", "last_active": "2026-09-09T12:05:00Z", "created_at": "2026-09-09T12:00:00Z"},
    # a hand dispatch between ticks: the architect already sits on hermes-MEM-F44, the ledger has no row
    {"id": "s-arch-f44", "agent_group_id": "ag-arch", "thread_id": "hermes-MEM-F44", "status": "active",
     "container_status": "running", "last_active": "2026-09-09T20:30:00Z", "created_at": "2026-09-09T20:00:00Z"},
]

MESSAGES = {
    "s-arch-f35": [
        {"seq": 1, "direction": "in", "kind": "chat", "timestamp": "2026-09-09T06:50:00Z", "sender": "orchestrator",
         "text": "Dispatch LOOP-F35: Lego coworker composition."},
        {"seq": 3, "direction": "out", "kind": "chat", "timestamp": "2026-09-09 09:57:00", "sender": "hermes-architect",
         "text": "[Spec handoff] LOOP-F35: Lego coworker composition\n- **CORE-CHANGE:** none"},
        {"seq": 5, "direction": "out", "kind": "chat", "timestamp": "2026-09-09 12:00:00", "sender": "hermes-architect",
         "text": "Spec handoff LOOP-F35: Lego coworker composition\nPriority: P0"},
    ],
    "s-build-f35": [
        {"seq": 2, "direction": "in", "kind": "chat", "timestamp": "2026-09-09T12:00:02Z", "sender": "hermes-architect",
         "text": "Spec handoff LOOP-F35: Lego coworker composition\nPriority: P0"},
    ],
    "s-arch-f44": [
        {"seq": 1, "direction": "in", "kind": "chat", "timestamp": "2026-09-09T20:00:00Z", "sender": "orchestrator",
         "text": "Dispatch MEM-F44: Transcript retention / archiving."},
    ],
}

FAKE_NCL = r'''#!/usr/bin/env python3
import json, sys
args = sys.argv[1:]
fx = json.load(open(sys.argv[0] + ".fixtures.json"))
def out(data): print(json.dumps({"id": "x", "ok": True, "data": data})); sys.exit(0)
if args[:2] == ["groups", "list"]: out(fx["groups"])
if args[:2] == ["sessions", "list"]: out(fx["sessions"])
if args[:2] == ["sessions", "messages"]:
    sid = args[2]
    if sid in fx["fail_messages"]:
        sys.stderr.write("session not found: " + sid); sys.exit(1)
    out(fx["messages"].get(sid, []))
if args[:2] == ["cost-cap", "status"]:
    out({"session_id": args[args.index("--session") + 1], "status": "ok"})
sys.stderr.write("unexpected: " + " ".join(args)); sys.exit(2)
'''
FAKE_GH = r'''#!/usr/bin/env python3
import json, sys
fx = json.load(open(sys.argv[0] + ".fixtures.json"))
print(json.dumps(fx["prs"]))
'''


@unittest.skipUnless(shutil.which("bash"), "bash not available")
class PullStateTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.ap = root / "autopilot"
        self.bin = root / "bin"
        self.bin.mkdir()
        self.ap.mkdir()
        for name, body in (("ncl", FAKE_NCL), ("gh", FAKE_GH)):
            p = self.bin / name
            p.write_text(body)
            os.chmod(p, 0o755)
        self.fixtures = {"groups": GROUPS, "sessions": SESSIONS, "messages": MESSAGES, "fail_messages": [], "prs": []}
        self.ledger = root / "ledger.md"
        shutil.copy(HERE / "fixtures" / "ledger.md", self.ledger)
        self.alerts = root / "status" / "alerts.md"

    def tearDown(self):
        self.tmp.cleanup()

    def run_pull(self, **env_extra) -> dict:
        (self.bin / "ncl.fixtures.json").write_text(json.dumps(self.fixtures))
        (self.bin / "gh.fixtures.json").write_text(json.dumps(self.fixtures))
        env = {
            **os.environ,
            "AUTOPILOT_DIR": str(self.ap), "LEDGER": str(self.ledger), "PLAN": str(DOCS / "dispatch-plan.md"),
            "MATRIX": str(DOCS / "gap-matrix.md"), "ALERTS": str(self.alerts), "NCL": str(self.bin / "ncl"),
            "GH": str(self.bin / "gh"), "NOW_OVERRIDE": NOW, "PATH": f"{self.bin}:{os.environ.get('PATH', '')}",
            **env_extra,
        }
        proc = subprocess.run(["bash", str(HERE / "pull-state.sh")], capture_output=True, text=True, env=env, check=False)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("pull-state: state.json written", proc.stdout)
        return json.loads((self.ap / "state.json").read_text())

    def test_state_written_with_queue_before_collector(self):
        st = self.run_pull()
        self.assertEqual(st["generated_at"], NOW)
        self.assertEqual(st["sources"]["core"], {"queue": "ok", "supervise": "ok"})
        self.assertEqual(st["sources"]["sessions"]["filter"]["rows"], ["LOOP-F35", "MEM-F44"])
        self.assertTrue(st["sources"]["fork"]["checked"])
        self.assertTrue((self.ap / "raw" / "prior-state.json").exists())
        self.assertTrue(self.alerts.exists())  # header created once
        # the config and bookkeeping files the script owns when absent
        self.assertEqual(json.loads((self.ap / "config.json").read_text())["wip"], 3)
        self.assertIn("nudges", json.loads((self.ap / "nudges.json").read_text()))

    def test_supervisor_sees_the_flattened_thread_and_nudges_the_stale_builder(self):
        st = self.run_pull()
        row = st["supervise"]["rows"]["LOOP-F35"]
        self.assertEqual(row["stage"], "building")
        self.assertEqual(row["clock_start"], "2026-09-09T12:00:00Z")
        self.assertEqual(row["age_hours"], 9.0)
        self.assertEqual((row["action"], row["target_role"]), ("nudge", "hermes-builder"))
        self.assertEqual([a["kind"] for a in st["actions"]], ["nudge"])
        flat = json.loads((self.ap / "raw" / "threads-flat.json").read_text())
        # the builder's `in` copy of the spec handoff is present in the flat view but counted once
        self.assertEqual(sum(1 for m in flat["hermes-LOOP-F35"] if m["text"].startswith("Spec handoff LOOP-F35")), 2)
        self.assertEqual(st["summary"]["must_nudge"], 1)

    def test_architect_session_on_a_thread_marks_the_row_dispatched(self):
        st = self.run_pull()
        self.assertEqual(st["rows"]["MEM-F44"]["state"], "dispatched")
        self.assertEqual(st["rows"]["MEM-F44"]["dispatched_at"], "2026-09-09T20:00:00Z")
        self.assertEqual(sorted(st["in_flight"]), ["LOOP-F35", "MEM-F44"])
        self.assertEqual(st["wip"]["in_flight"], 2)
        self.assertNotIn("MEM-F44", [e["id"] for e in st["eligible_next"]])
        self.assertIn("MEM-F44", st["dispatch_overlays"])
        # fresh dispatch (1 h old): no nudge yet
        self.assertEqual(st["supervise"]["rows"]["MEM-F44"]["action"], "none")

    def test_unread_session_makes_the_thread_unreadable_and_draws_no_action(self):
        self.fixtures["fail_messages"] = ["s-build-f35"]
        st = self.run_pull()
        flat = json.loads((self.ap / "raw" / "threads-flat.json").read_text())
        self.assertIsNone(flat["hermes-LOOP-F35"])
        row = st["supervise"]["rows"]["LOOP-F35"]
        self.assertEqual((row["action"], row["slo_status"]), ("none", "unknown"))
        self.assertIn("unreadable", row["reason"])
        self.assertEqual(st["actions"], [])
        self.assertIn("hermes-LOOP-F35", st["threads_unreadable"])
        self.assertTrue(any(e["source"] == "ncl sessions messages s-build-f35" for e in st["collector_errors"]))

    def test_deadline_zero_reads_everything_and_rows_filter_can_be_disabled(self):
        st = self.run_pull(COLLECT_ROWS_FROM_QUEUE="0")
        self.assertIsNone(st["sources"]["sessions"]["filter"]["rows"])
        self.assertEqual(st["sources"]["sessions"]["sessions_read"], 3)

    def test_gate_supervise_prints_json_last_and_wakes_on_a_nudge(self):
        """The one remaining task gate (the dispatch tick is dispatch-cron.sh on the host; test_dispatch_cron.py)."""
        (self.bin / "ncl.fixtures.json").write_text(json.dumps(self.fixtures))
        (self.bin / "gh.fixtures.json").write_text(json.dumps(self.fixtures))
        env = {
            **os.environ,
            "AUTOPILOT_DIR": str(self.ap), "LEDGER": str(self.ledger), "PLAN": str(DOCS / "dispatch-plan.md"),
            "MATRIX": str(DOCS / "gap-matrix.md"), "ALERTS": str(self.alerts), "NCL": str(self.bin / "ncl"),
            "GH": str(self.bin / "gh"), "NOW_OVERRIDE": NOW, "PATH": f"{self.bin}:{os.environ.get('PATH', '')}",
        }
        shutil.copy(HERE / "pull-state.sh", self.ap / "pull-state.sh")
        for f in ("hermes_queue.py", "hermes_supervise.py", "collect_threads.py", "scorecard.py"):
            shutil.copy(HERE / f, self.ap / f)
        proc = subprocess.run(["bash", str(HERE / "gate-supervise.sh")], capture_output=True, text=True, env=env, check=False)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        last = json.loads(proc.stdout.strip().splitlines()[-1])
        self.assertTrue(last["wakeAgent"])
        self.assertEqual(last["data"]["actions"], {"nudge": 1})
        self.assertFalse(last["data"]["partial"])
        # the queue half of the same state: nothing eligible, 1a has no tester PASS yet
        st = json.loads((self.ap / "state.json").read_text())
        self.assertEqual(st["eligible_next"], [])


if __name__ == "__main__":
    sys.exit(unittest.main())
