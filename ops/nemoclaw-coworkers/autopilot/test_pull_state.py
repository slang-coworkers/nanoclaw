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
# 2026-09-16: roles addressed with a mis-cased thread (one test adds them): the tester lives on `hermes-loop-f35`,
# an architect on `hermes-ops-f58.a`
STRAY_SESSIONS = [
    {"id": "s-test-lower", "agent_group_id": "ag-test", "thread_id": "hermes-loop-f35", "status": "active",
     "container_status": "stopped", "last_active": "2026-09-09T13:00:00Z", "created_at": "2026-09-09T12:30:00Z"},
    {"id": "s-arch-lower-58", "agent_group_id": "ag-arch", "thread_id": "hermes-ops-f58.a", "status": "active",
     "container_status": "running", "last_active": "2026-09-09T20:45:00Z", "created_at": "2026-09-09T20:40:00Z"},
]
STRAY_MESSAGES = {
    "s-test-lower": [
        {"seq": 1, "direction": "in", "kind": "chat", "timestamp": "2026-09-09T12:30:00Z", "sender": "hermes-builder",
         "text": "heads-up: PR coming on LOOP-F35, test round 1 soon"},
    ],
    "s-arch-lower-58": [
        {"seq": 1, "direction": "in", "kind": "chat", "timestamp": "2026-09-09T20:40:00Z", "sender": "orchestrator", "text": "Dispatch OPS-F58.a: doctor."},
    ],
}

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

    def test_abtr_markdown_and_brief_written_next_to_alerts_and_state(self):
        st = self.run_pull()
        md = (self.alerts.parent / "autopilot.md").read_text()  # STATUS_DIR defaults next to alerts.md
        # the header's tick is `MM-DD HH:MMZ` (abtr.fmt_tick) and ends with the task-card count
        self.assertTrue(md.startswith(f"Hermes autopilot · {NOW[5:10]} {NOW[11:16]}Z · in flight 2/3 · "), md.splitlines()[0])
        self.assertIn(" · cards 24h ", md.splitlines()[0])
        self.assertIn("| LOOP-F35 | 1a | ✓ ", md)   # spec accepted 15:27 IST, builder holds the row
        self.assertIn("| ▶ 9.0h | · | · | · |", md)
        self.assertIn("| MEM-F44 | 1b | ▶ 1.0h | · | · | · | · |", md)   # the hand dispatch, no ledger row
        self.assertIn("queued: ", md)
        self.assertLessEqual(max(len(line) for line in md.splitlines()), 120)
        brief = (self.ap / "tick-report.txt").read_text().splitlines()
        self.assertEqual(brief[0], md.splitlines()[0])
        self.assertEqual(brief[1:3], ["LOOP-F35 | ✓ 09:57Z | ▶ 9.0h | · | ·", "MEM-F44 | ▶ 1.0h | · | · | ·"])
        self.assertEqual(brief[-1], "full table: /status/autopilot.md")
        self.assertEqual(st["sources"]["core"], {"queue": "ok", "supervise": "ok"})

    def test_abtr_render_failure_does_not_fail_the_collector(self):
        # A directory that cannot be created (a regular file in the way) makes the write fail; the pull still exits 0.
        blocker = Path(self.tmp.name) / "blocker"
        blocker.write_text("not a directory")
        st = self.run_pull(STATUS_DIR=str(blocker / "status"))
        self.assertEqual(st["generated_at"], NOW)
        self.assertFalse((blocker / "status" / "autopilot.md").exists())

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

    def test_acks_json_feeds_the_supervisor_and_is_reported(self):
        """acks.json (collect-acks.sh, host) next to state.json: a bounced ack on LOOP-F35's builder (the ISO-F14
        shape) is detected and reported under sources.acks; without the file the detection is off and the
        ordinary SLO nudge is back. A recorded `Supervisor re-arm` text never becomes the row's 6 h bound."""
        acks = {"generated_at": NOW, "sessions": {"s-build-f35": {
            "status": "bounced-transient", "changed": "2026-09-09T20:30:00.000Z", "role": "hermes-builder", "thread_id": "hermes-LOOP-F35"}}}
        (self.ap / "acks.json").write_text(json.dumps(acks))
        st = self.run_pull()
        self.assertEqual((st["sources"]["acks"]["status"], st["sources"]["acks"]["checked"]), ("ok", True))
        self.assertEqual(st["sources"]["acks"]["path"], str(self.ap / "acks.json"))
        row = st["supervise"]["rows"]["LOOP-F35"]
        self.assertEqual((row["stage"], row["bounced"]["status"], row["bounced"]["changed"]), ("building", "bounced-transient", "2026-09-09T20:30:00Z"))
        nudge = next(a for a in st["actions"] if a["kind"] == "nudge" and a["row"] == "LOOP-F35")
        self.assertEqual((nudge["target_role"], nudge["check"], nudge["rearm_role"], nudge["rearm_session_id"]), ("orchestrator", "bounced", "hermes-builder", "s-build-f35"))
        self.assertEqual(st["summary"]["bounced"], 1)
        # the Orchestrator recorded the re-arm: texts reach the book, the 6 h bound does not move
        (self.ap / "nudges.json").write_text(json.dumps({"nudges": [
            {"row": "LOOP-F35", "at": "2026-09-09T20:40:00Z", "role": "hermes-builder", "state": "building", "text": nudge["rearm_text"]}],
            "alerts": [], "dispatched": [], "redispatched": [], "round3": []}))
        st2 = self.run_pull()
        book = json.loads((self.ap / "raw" / "nudge-book.json").read_text())["LOOP-F35"]
        self.assertEqual((book["count"], book["last_nudge"], book["texts"]), (0, None, [nudge["rearm_text"]]))
        self.assertEqual(book["rearms"], [{"at": "2026-09-09T20:40:00Z", "text": nudge["rearm_text"]}])  # timed: the per-(row, role) re-arm cap reads `at`
        # same bounce, re-arm already sent: no second re-arm. (The one nudge left is the pre-existing card_missing
        # check on the architect's card-less [Spec handoff] — the live config.json has card_check on.)
        self.assertEqual([a.get("check") for a in st2["actions"] if a["kind"] == "nudge"], ["card_missing"])
        self.assertEqual(st2["supervise"]["rows"]["LOOP-F35"]["bounced"]["changed"], "2026-09-09T20:30:00Z")
        # a stale file (older than 2 h) or none at all: detection off, reported, the ordinary nudge is back
        acks["generated_at"] = "2026-09-09T18:30:00Z"
        (self.ap / "acks.json").write_text(json.dumps(acks))
        st3 = self.run_pull()
        self.assertEqual((st3["sources"]["acks"]["status"], st3["sources"]["acks"]["checked"], st3["summary"]["acks"]), ("stale", False, "stale"))
        self.assertIsNone(st3["supervise"]["rows"]["LOOP-F35"]["bounced"])
        (self.ap / "acks.json").unlink()
        st4 = self.run_pull()
        self.assertEqual(st4["sources"]["acks"]["status"], "missing")
        self.assertIn("bounce and idle detection off", st4["sources"]["acks"]["note"])
        plain = next(a for a in st4["actions"] if a["kind"] == "nudge")
        self.assertEqual((plain["target_role"], plain.get("check")), ("hermes-builder", None))

    def test_deadline_zero_reads_everything_and_rows_filter_can_be_disabled(self):
        st = self.run_pull(COLLECT_ROWS_FROM_QUEUE="0")
        self.assertIsNone(st["sources"]["sessions"]["filter"]["rows"])
        self.assertEqual(st["sources"]["sessions"]["sessions_read"], 3)

    def test_miscased_thread_flows_through_the_flat_views_and_the_dispatch_overlay(self):
        """2026-09-16: a session on `hermes-loop-f35` is LOOP-F35's for every view pull-state.sh builds — the flat thread
        (its line is read with the row), sessions-by-thread (with the thread it really lives on as thread_id_raw, which the
        supervisor puts on pinned sends), the state's thread_case list — and an architect session on a mis-cased thread
        still marks its row dispatched (never dispatch twice)."""
        self.fixtures["sessions"] = SESSIONS + STRAY_SESSIONS
        self.fixtures["messages"] = {**MESSAGES, **STRAY_MESSAGES}
        st = self.run_pull()
        flat = json.loads((self.ap / "raw" / "threads-flat.json").read_text())
        self.assertTrue(any(m["text"].startswith("heads-up: PR coming on LOOP-F35") for m in flat["hermes-LOOP-F35"]))
        self.assertNotIn("hermes-loop-f35", flat)
        by_thread = json.loads((self.ap / "raw" / "sessions-by-thread.json").read_text())
        tester = next(s for s in by_thread["hermes-LOOP-F35"] if s["session_id"] == "s-test-lower")
        self.assertEqual((tester["role"], tester["thread_id_raw"]), ("hermes-tester", "hermes-loop-f35"))
        builder = next(s for s in by_thread["hermes-LOOP-F35"] if s["session_id"] == "s-build-f35")
        self.assertEqual(builder["thread_id_raw"], "hermes-LOOP-F35")
        self.assertEqual(sorted(st["sources"]["sessions"]["thread_case"], key=lambda t: t["row"]), [
            {"row": "LOOP-F35", "session_id": "s-test-lower", "role": "hermes-tester", "thread_id_raw": "hermes-loop-f35"},
            {"row": "OPS-F58.a", "session_id": "s-arch-lower-58", "role": "hermes-architect", "thread_id_raw": "hermes-ops-f58.a"},
        ])
        # the supervisor's thread-case alert rides beside the row's ordinary nudge
        row = st["supervise"]["rows"]["LOOP-F35"]
        self.assertEqual(row["thread_case"], [{"thread_id_raw": "hermes-loop-f35", "roles": ["hermes-tester"], "session_ids": ["s-test-lower"]}])
        self.assertEqual((row["action"], row["target_role"]), ("nudge", "hermes-builder"))
        self.assertIn(("alert", "thread-case:hermes-loop-f35"), [(a["kind"], a.get("alert_key")) for a in st["actions"]])
        # the mis-cased architect session is a dispatch overlay for OPS-F58.a, spelled canonically
        self.assertEqual(st["rows"]["OPS-F58.a"]["state"], "dispatched")
        self.assertEqual(st["rows"]["OPS-F58.a"]["dispatched_at"], "2026-09-09T20:40:00Z")
        self.assertEqual(st["dispatch_overlays"]["OPS-F58.a"], "session s-arch-lower-58 on thread hermes-ops-f58.a")
        self.assertIn("OPS-F58.a", st["in_flight"])

    def test_inferred_session_reads_as_the_row_thread_never_its_own(self):
        """collect_threads pass 2: a reviewer with no per-thread session, whose DM (`hermes-P0-LOOP`) mentions LOOP-F35, is
        attached to the row as inferred. sessions-by-thread must NOT carry its real thread as thread_id_raw — the
        supervisor would raise a false thread-case and re-route the row's pinned nudge into hermes-P0-LOOP."""
        inferred = {"id": "s-rev-dm", "agent_group_id": "ag-rev", "thread_id": "hermes-P0-LOOP", "status": "active",
                    "container_status": "stopped", "last_active": "2026-09-09T13:00:00Z", "created_at": "2026-09-09T12:30:00Z"}
        self.fixtures["sessions"] = SESSIONS + [inferred]
        self.fixtures["messages"] = {**MESSAGES, "s-rev-dm": [
            {"seq": 1, "direction": "in", "kind": "chat", "timestamp": "2026-09-09T12:30:00Z", "sender": "orchestrator",
             "text": "FYI the review for LOOP-F35: round 1 coming"}]}
        st = self.run_pull()
        by_thread = json.loads((self.ap / "raw" / "sessions-by-thread.json").read_text())
        rev = next(s for s in by_thread["hermes-LOOP-F35"] if s["session_id"] == "s-rev-dm")
        self.assertEqual((rev["role"], rev["inferred"], rev["thread_id_raw"]), ("hermes-reviewer", True, "hermes-LOOP-F35"))
        self.assertIsNone(st["supervise"]["rows"]["LOOP-F35"]["thread_case"])
        self.assertNotIn("thread-case", [a.get("alert_kind") for a in st["actions"]])
        self.assertEqual(st["sources"]["sessions"]["thread_case"], [])
        nudge = next(a for a in st["actions"] if a["kind"] == "nudge" and a["row"] == "LOOP-F35")
        self.assertEqual((nudge["thread_id"], "row_thread_id" in nudge), ("hermes-LOOP-F35", False))

    def test_operator_dm_ask_flows_through_the_flat_file_to_a_decision_needed_line(self):
        """2026-09-16/17: the Orchestrator's ask on its operator DM (a non-row thread) reaches the supervisor through the
        collector's pass 3 -> threads-flat.json "operator_threads" -> an `operator-ruling` alert attributed to the one row
        it names, `state.operator_asks`, and the tick report's DECISION NEEDED line right under the header."""
        ask = ("**LOOP-F35 — compose render COMPLETE & verified; sandbox tier blocked on 2 new items. Your call again.** "
               "I'm asking them deploy-now vs defer-carry. Hold — report up when the sandbox tier runs (or the operator rules defer-carry).")
        dm = {"id": "s-orch-dm", "agent_group_id": "ag-orch", "thread_id": "sess-1789461233002-7tpn00", "status": "active",
              "container_status": "stopped", "last_active": "2026-09-09T20:50:00Z", "created_at": "2026-09-08T10:00:00Z"}
        self.fixtures["sessions"] = SESSIONS + [dm]
        self.fixtures["messages"] = {**MESSAGES, "s-orch-dm": [
            {"seq": 1, "direction": "out", "kind": "chat", "timestamp": "2026-09-09 18:00:00", "sender": "orchestrator", "text": "hermes-status-report: 2 rows in flight"},
            {"seq": 2, "direction": "out", "kind": "chat", "timestamp": "2026-09-09 19:15:00", "sender": "orchestrator", "text": ask},
        ]}
        st = self.run_pull()
        flat = json.loads((self.ap / "raw" / "threads-flat.json").read_text())
        self.assertEqual([(e["session_id"], e["thread_id"], e["role"]) for e in flat["operator_threads"]], [("s-orch-dm", "sess-1789461233002-7tpn00", "orchestrator")])
        self.assertEqual([m["ts"] for m in flat["operator_threads"][0]["messages"]], ["2026-09-09T18:00:00Z", "2026-09-09T19:15:00Z"])
        self.assertNotIn("sess-1789461233002-7tpn00", flat)  # never a row thread key
        self.assertEqual(st["sources"]["sessions"]["operator_sessions"], 1)
        row = st["supervise"]["rows"]["LOOP-F35"]
        self.assertEqual((row["operator_ask"]["count"], row["operator_ask"]["newest"]["thread_id"]), (1, "sess-1789461233002-7tpn00"))
        self.assertEqual([(a["row"], a["alerted"], a["age_hours"]) for a in st["operator_asks"]], [("LOOP-F35", True, 1.75)])
        alert = next(a for a in st["actions"] if a["kind"] == "alert" and a.get("check") == "operator_ask")
        self.assertEqual((alert["row"], alert["alert_kind"], alert["ask_thread_id"]), ("LOOP-F35", "operator-ruling", "sess-1789461233002-7tpn00"))
        self.assertTrue(alert["alert_key"].startswith("operator-ruling:ask:"))
        self.assertTrue(alert["status_text"].startswith("DECISION NEEDED (1h): LOOP-F35 — LOOP-F35 — compose render COMPLETE & verified"), alert["status_text"])
        self.assertEqual(st["summary"]["operator_ask"], 1)
        # the ordinary SLO nudge to the stale builder still runs beside it
        self.assertEqual([(a["target_role"], a.get("check")) for a in st["actions"] if a["kind"] == "nudge"], [("hermes-builder", None)])
        brief = (self.ap / "tick-report.txt").read_text().splitlines()
        self.assertTrue(brief[1].startswith("DECISION NEEDED (1h): LOOP-F35 — LOOP-F35 — compose render COMPLETE"), brief[1])
        self.assertEqual(brief[2], "LOOP-F35 | ✓ 09:57Z | ▶ 9.0h | · | ·")
        md = (self.alerts.parent / "autopilot.md").read_text().splitlines()
        self.assertTrue(md[1].startswith("DECISION NEEDED (1h): LOOP-F35"))
        # recorded (record.py alerted --row LOOP-F35 --reason <alert_key>): the next tick is quiet, the ask stays on the table
        (self.ap / "nudges.json").write_text(json.dumps({"nudges": [], "alerts": [{"row": "LOOP-F35", "reason": alert["alert_key"], "at": "2026-09-09T20:47:00Z", "line": alert["text"]}],
                                                         "dispatched": [], "redispatched": [], "round3": []}))
        st2 = self.run_pull()
        self.assertEqual([a for a in st2["actions"] if a.get("check") == "operator_ask"], [])
        self.assertEqual((st2["operator_asks"][0]["alerted"], st2["operator_asks"][0]["bound"]), (False, "2026-09-09T20:47:00Z"))
        self.assertTrue((self.ap / "tick-report.txt").read_text().splitlines()[1].startswith("DECISION NEEDED (1h): LOOP-F35"))
        # answered on the DM in the operator's own words (no "Operator" prefix, no sender on the transcript row): gone — the
        # flat view never stamps an inbound line with the Orchestrator's identity, so the loose DM-answer rule sees it
        self.fixtures["messages"]["s-orch-dm"].append({"seq": 3, "direction": "in", "kind": "chat", "timestamp": "2026-09-09T20:40:00Z", "text": "defer-carry; carry both items to the follow-up."})
        st3 = self.run_pull()
        flat3 = json.loads((self.ap / "raw" / "threads-flat.json").read_text())
        reply = flat3["operator_threads"][0]["messages"][-1]
        self.assertEqual((reply["direction"], reply["sender"], reply["role"]), ("in", None, None))
        self.assertEqual((st3["operator_asks"], st3["summary"]["operator_ask"]), ([], 0))
        self.assertIsNone(st3["supervise"]["rows"]["LOOP-F35"]["operator_ask"])
        self.assertEqual(st3["sources"]["sessions"]["operator_unread"], 0)

    def test_follow_up_ledger_row_is_collected_and_supervised_not_unknown(self):
        """A `<PARENT>.<letter>` ledger row (SCHED-F34.a, opened on operator instruction) is a follow-up: no
        `ledger-unknown-id`, its thread is read with the in-flight rows, the supervisor stages it, WIP is untouched."""
        with open(self.ledger, "a", encoding="utf-8") as fh:
            fh.write("| SCHED-F34.a | 2026-09-09 20:00Z (to hermes-architect, thread `hermes-SCHED-F34.a`) | — | — | — | — | follow-up: operator \"Open it\" (msg 290) |\n")
        arch = {"id": "s-arch-f34a", "agent_group_id": "ag-arch", "thread_id": "hermes-SCHED-F34.a", "status": "active",
                "container_status": "running", "last_active": "2026-09-09T20:30:00Z", "created_at": "2026-09-09T20:00:00Z"}
        self.fixtures["sessions"] = SESSIONS + [arch]
        self.fixtures["messages"] = {**MESSAGES, "s-arch-f34a": [
            {"seq": 1, "direction": "in", "kind": "chat", "timestamp": "2026-09-09T20:00:00Z", "sender": "orchestrator", "text": "Dispatch SCHED-F34.a: TZ follow-up (operator ruling B)."}]}
        st = self.run_pull()
        self.assertEqual([a for a in st["alerts"] if a["kind"] == "ledger-unknown-id"], [])
        self.assertEqual((st["follow_up_rows"]["SCHED-F34.a"]["parent"], st["follow_up_rows"]["SCHED-F34.a"]["state"]), ("SCHED-F34", "dispatched"))
        self.assertEqual((st["follow_up_in_flight"], st["coverage"]["follow_ups"], st["coverage"]["total"]), (["SCHED-F34.a"], 1, 64))
        self.assertEqual(sorted(st["in_flight"]), ["LOOP-F35", "MEM-F44"])
        self.assertEqual(st["wip"]["in_flight"], 2)
        self.assertEqual(st["sources"]["sessions"]["filter"]["rows"], ["LOOP-F35", "MEM-F44", "SCHED-F34.a"])
        flat = json.loads((self.ap / "raw" / "threads-flat.json").read_text())
        self.assertEqual(len(flat["hermes-SCHED-F34.a"]), 1)  # read, not "not in flight"
        row = st["supervise"]["rows"]["SCHED-F34.a"]
        self.assertEqual((row["stage"], row["age_hours"], row["action"], row["follow_up"]["parent"]), ("dispatched", 1.0, "none", "SCHED-F34"))
        self.assertEqual(st["summary"]["follow_ups"], 1)
        self.assertNotIn("SCHED-F34.a", [e["id"] for e in st["eligible_next"]])

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
        for f in ("hermes_queue.py", "hermes_supervise.py", "collect_threads.py", "rowid.py", "scorecard.py", "abtr.py"):
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
