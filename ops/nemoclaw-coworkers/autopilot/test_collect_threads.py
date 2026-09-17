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
# 2026-09-16: a role addressed with a mis-cased thread — its session lives on `hermes-loop-f35` (one test adds it)
STRAY_SESSION = {"id": "s-rev-lower", "agent_group_id": "ag-rev", "thread_id": "hermes-loop-f35", "status": "active",
                 "container_status": "stopped", "last_active": "2026-09-09T11:40:00Z"}
STRAY_MESSAGES = [
    {"seq": 7, "direction": "out", "kind": "chat", "timestamp": "2026-09-09 11:40:00", "sender": "hermes-reviewer",
     "text": "[Review Verdict] slang-coworkers/hermes-agent#7 (round 1, head a1b2c3d)\n\n- **Verdict:** REQUEST_CHANGES"},
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
with open(sys.argv[0] + ".calls.log", "a") as fh:
    fh.write(json.dumps(args) + "\n")
if args[:2] == ["sessions", "messages"]:
    sid = args[2]
    if fixtures.get("sleep_s"):
        import time; time.sleep(fixtures["sleep_s"])
    if sid in fixtures["fail_messages"]:
        sys.stderr.write("session not found: " + sid); sys.exit(1)
    # src/cli/session-messages.ts: ascending by seq, `--reverse` newest first, then slice(offset, offset + limit) —
    # so a plain `--limit N` returns the OLDEST N rows of a transcript
    rows = list(fixtures["messages"].get(sid, []))
    rows.sort(key=lambda r: (r.get("seq") or 0) if isinstance(r, dict) else 0, reverse="--reverse" in args)
    if "--limit" in args:
        rows = rows[:int(args[args.index("--limit") + 1])]
    print(json.dumps({"id": "x", "ok": True, "data": rows})); sys.exit(0)
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

    def calls(self) -> list:
        """Every argv the fake ncl was invoked with, in order (across the test's run_collect calls)."""
        log = self.dir / "ncl.calls.log"
        return [json.loads(line) for line in log.read_text().splitlines()] if log.exists() else []

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

    def test_miscased_thread_session_is_attributed_to_the_row_and_keeps_its_real_thread(self):
        """ISO-F13, 2026-09-16: the reviewer's REQUEST_CHANGES sat on `hermes-iso-f13` and was invisible. The session is
        read as part of the row (canonical thread), its record keeps the thread it really lives on, and the top-level
        `thread_case` list names it — `other_threads` does not."""
        (self.dir / "sessions.json").write_text(json.dumps(SESSIONS + [STRAY_SESSION]))
        self.fixtures["messages"] = {**MESSAGES, "s-rev-lower": STRAY_MESSAGES}
        out = self.run_collect()
        f35 = out["threads"]["LOOP-F35"]
        self.assertEqual(f35["thread_id"], "hermes-LOOP-F35")
        rev = next(s for s in f35["sessions"] if s["id"] == "s-rev-lower")
        self.assertEqual((rev["role"], rev["thread_id"], rev["thread_case"]), ("hermes-reviewer", "hermes-loop-f35", True))
        self.assertEqual(rev["messages"][0]["text"].split("\n")[0], "[Review Verdict] slang-coworkers/hermes-agent#7 (round 1, head a1b2c3d)")
        self.assertNotIn("thread_case", next(s for s in f35["sessions"] if s["id"] == "s-arch-f35"))
        self.assertEqual(out["thread_case"], [{"row": "LOOP-F35", "session_id": "s-rev-lower", "role": "hermes-reviewer", "thread_id_raw": "hermes-loop-f35"}])
        self.assertEqual(out["counts"]["thread_case"], 1)
        self.assertNotIn("hermes-loop-f35", out["other_threads"])
        self.assertNotIn("loop-f35", out["threads"])
        # the --rows filter matches the canonical id, so the stray session is read with the row (not left unread)
        filtered = self.run_collect("--rows", "LOOP-F35")
        rev = next(s for s in filtered["threads"]["LOOP-F35"]["sessions"] if s["id"] == "s-rev-lower")
        self.assertNotIn("messages_error", rev)

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

    def test_mentions_in_any_casing_of_the_tag_forms_land_on_the_canonical_row(self):
        """Pass 2 (a role with no per-thread session) attributes by free-text mention. The `hermes-<ROW>` and `[<ROW>]`
        tags match in any casing and fold to the canonical id (rowid.canon_row); the bare `<ROW>:` form stays strict —
        a lower-case `x-f1:` is prose. Only canonical ids are ever minted as rows."""
        sys.path.insert(0, str(HERE))
        import collect_threads as ct
        self.assertEqual(ct.mentioned_rows([{"text": "please test on thread hermes-iso-f13 now"}]), {"ISO-F13"})
        self.assertEqual(ct.mentioned_rows([{"text": "[iso-f13] round 2; also [Ops-F58.A] and hermes-LOOP-F35"}]), {"ISO-F13", "OPS-F58.a", "LOOP-F35"})
        self.assertEqual(ct.mentioned_rows([{"text": "iso-f13: the lower-case bare form is prose"}, {"text": "ISO-F13: the strict bare form"}]), {"ISO-F13"})
        self.assertEqual(ct.mentioned_rows([{"text": "hermes-status hermes-p6-fleet [Blocker] x-f1: nothing here"}, {}]), set())
        # through the collector: the builder's session (no thread) mentions the row as [loop-f35]
        self.fixtures["messages"] = {**MESSAGES, "s-build-nothread": [dict(MESSAGES["s-build-nothread"][0], text="Spec handoff [loop-f35]: Lego coworker composition")]}
        out = self.run_collect()
        build = [s for s in out["threads"]["LOOP-F35"]["sessions"] if s["role"] == "hermes-builder"]
        self.assertEqual((len(build), build[0]["inferred"], build[0]["id"]), (1, True, "s-build-nothread"))
        self.assertNotIn("loop-f35", out["threads"])

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


ORCH_DM = {"id": "s-orch-dm", "agent_group_id": "ag-orch", "thread_id": "sess-1789461233002-7tpn00", "status": "active",
           "container_status": "stopped", "last_active": "2026-09-09T11:30:00Z"}
ORCH_TASK = {"id": "s-orch-task", "agent_group_id": "ag-orch", "thread_id": "system:tasks:hermes-nightly-regressio-8ee3", "status": "active",
             "container_status": "stopped", "last_active": "2026-09-09T01:10:00Z"}
ORCH_STATUS = {"id": "s-orch-status", "agent_group_id": "ag-orch", "thread_id": "hermes-status", "status": "active",
               "container_status": "stopped", "last_active": "2026-09-09T11:00:00Z"}
ORCH_OLD = {"id": "s-orch-old", "agent_group_id": "ag-orch", "thread_id": "sess-000-old", "status": "active",
            "container_status": "stopped", "last_active": "2026-09-05T11:00:00Z"}
ORCH_NOTHREAD = {"id": "s-orch-none", "agent_group_id": "ag-orch", "thread_id": None, "status": "active",
                 "container_status": "stopped", "last_active": "2026-09-09T10:00:00Z"}
ASK_A = ("**ISO-F14 — render COMPLETE & verified; sandbox tier blocked on 2 new items. Your call again.** I'm asking them "
         "deploy-now vs defer-carry. Hold — report up when the sandbox tier runs (or the operator rules defer-carry).")


def dm_messages() -> list:
    """46 outbound lines over three days plus operator inbound lines: the tail / window / head bounds have something to cut."""
    out = []
    seq = 1
    for i in range(46):
        # 2026-09-07T12:00 .. 2026-09-09T09:00 hourly-ish: the first ones fall outside the 48 h window (NOW 2026-09-09T12:00)
        hour = 12 + i
        day = 7 + hour // 24
        stamp = f"2026-09-{day:02d} {hour % 24:02d}:00:00"
        out.append({"seq": seq, "direction": "out", "kind": "chat", "timestamp": stamp, "sender": "orchestrator", "text": f"status line {i} " + "x" * 700})
        seq += 1
    out.append({"seq": seq, "direction": "in", "kind": "chat", "timestamp": "2026-09-07T13:30:00Z", "sender": "operator", "text": "Operator — early answer, before the kept tail"})
    out.append({"seq": seq + 1, "direction": "in", "kind": "chat", "timestamp": "2026-09-09T10:30:00Z", "sender": "operator", "text": "Operator ruling: defer-carry"})
    out.append({"seq": seq + 2, "direction": "out", "kind": "chat", "timestamp": "2026-09-09 11:15:00", "sender": "orchestrator", "text": ASK_A})
    return out


class OperatorThreadsTest(CollectThreadsTest):
    """Pass 3: the Orchestrator's non-row sessions (operator DM / main, system:tasks:*) are read, bounded, for the
    operator-ask detection; hermes-status, row threads, closed and stale sessions are not."""

    def test_operator_sessions_are_collected_bounded(self):
        (self.dir / "sessions.json").write_text(json.dumps(SESSIONS + [ORCH_DM, ORCH_TASK, ORCH_STATUS, ORCH_OLD, ORCH_NOTHREAD]))
        self.fixtures["messages"] = {**MESSAGES, "s-orch-dm": dm_messages(), "s-orch-task": [
            {"seq": 1, "direction": "out", "kind": "chat", "timestamp": "2026-09-09 01:04:00", "sender": "orchestrator", "text": "One ruling: … please use this exact framing"}]}
        out = self.run_collect("--rows", "LOOP-F35")
        ops = {e["session_id"]: e for e in out["operator_threads"]}
        # newest first, the P0-LOOP DM (a hermes-* thread that is not a row) included, hermes-status and the 4-day-old one not
        self.assertEqual([e["session_id"] for e in out["operator_threads"]], ["s-orch-dm", "s-orch-none", "s-orch-p0", "s-orch-task"])
        self.assertEqual((ops["s-orch-dm"]["thread_id"], ops["s-orch-none"]["thread_id"], ops["s-orch-task"]["role"]), ("sess-1789461233002-7tpn00", None, "orchestrator"))
        dm = ops["s-orch-dm"]["messages"]
        outs = [m for m in dm if m["direction"] == "out"]
        ins = [m for m in dm if m["direction"] == "in"]
        self.assertEqual(len(outs), 40)  # the tail
        self.assertEqual(outs[-1]["text"], ASK_A)
        self.assertTrue(all(len(m["text"]) <= 600 for m in dm))  # the head
        self.assertTrue(all(m["timestamp"] >= "2026-09-07 12:00:00" for m in outs))  # nothing older than 48 h
        self.assertEqual([m["text"] for m in ins], ["Operator ruling: defer-carry"])  # inbound since the oldest kept outbound only
        norm = [m["timestamp"].replace("T", " ").replace("Z", "") for m in dm]
        self.assertEqual(norm, sorted(norm))  # time order across both stamp shapes (inbound ISO, outbound SQL)
        self.assertEqual(ops["s-orch-task"]["messages"][0]["text"], "One ruling: … please use this exact framing")
        self.assertEqual(ops["s-orch-p0"]["messages"], [])
        c = out["counts"]
        self.assertEqual((c["operator_sessions"], c["operator_read"], c["operator_unread"]), (4, 4, 0))
        self.assertEqual(c["operator_messages"], 41 + 0 + 0 + 1)
        # the row-session budget is untouched by pass 3
        self.assertEqual(c["sessions_read"], self.run_collect("--rows", "LOOP-F35", "--operator-sessions", "0")["counts"]["sessions_read"])
        self.assertNotIn("s-orch-dm", out["threads"].get("LOOP-F35", {}).get("sessions", []))
        self.assertIn("hermes-P0-LOOP", out["other_threads"])

    def test_operator_pass_off_cap_window_and_read_failures(self):
        (self.dir / "sessions.json").write_text(json.dumps(SESSIONS + [ORCH_DM, ORCH_TASK]))
        off = self.run_collect("--operator-sessions", "0")
        self.assertEqual((off["operator_threads"], off["counts"]["operator_sessions"]), ([], 0))
        one = self.run_collect("--operator-sessions", "1")
        self.assertEqual([e["session_id"] for e in one["operator_threads"]], ["s-orch-dm"])
        narrow = self.run_collect("--operator-since-h", "2")
        self.assertEqual([e["session_id"] for e in narrow["operator_threads"]], ["s-orch-dm"])  # 11:30 is inside 2 h of 12:00; the rest is not
        self.fixtures["messages"] = {**MESSAGES, "s-orch-dm": dm_messages()}
        small = self.run_collect("--operator-tail", "3", "--operator-head", "20")
        dm = next(e for e in small["operator_threads"] if e["session_id"] == "s-orch-dm")["messages"]
        self.assertEqual(len([m for m in dm if m["direction"] == "out"]), 3)
        self.assertTrue(all(len(m["text"]) <= 20 for m in dm))
        self.fixtures["fail_messages"] = ["s-orch-dm"]
        failed = self.run_collect()
        dm_rec = next(e for e in failed["operator_threads"] if e["session_id"] == "s-orch-dm")
        self.assertIn("session not found", dm_rec["messages_error"])
        self.assertEqual(dm_rec["messages"], [])
        self.assertEqual((failed["counts"]["operator_unread"], failed["counts"]["operator_read"]), (1, 2))
        self.assertTrue(any(e["source"] == "ncl sessions messages s-orch-dm" for e in failed["collector_errors"]))

    def test_operator_reads_run_first_on_their_own_reserve_and_never_starve_on_the_row_budget(self):
        """Under the gate's 10 s collector budget the operator reads used to come last and go first. Pass 3 now runs BEFORE
        the row passes on its own reserve (`--operator-deadline-s`, default 3): a spent row budget cannot touch it, and its
        own reserve hitting is its own collector_errors line plus `operator_unread` (pull-state's summary shows it)."""
        (self.dir / "sessions.json").write_text(json.dumps(SESSIONS + [ORCH_DM, ORCH_NOTHREAD]))
        self.fixtures["sleep_s"] = 0.15
        starved_rows = self.run_collect("--deadline-s", "0.01", "--scan-fallback", "0")
        c = starved_rows["counts"]
        self.assertEqual((c["operator_sessions"], c["operator_read"], c["operator_unread"]), (3, 3, 0))  # dm, none, p0: all read
        self.assertTrue(all("messages_error" not in e for e in starved_rows["operator_threads"]))
        self.assertEqual(c["sessions_read"], 1)  # the row budget starts AFTER pass 3: one row read, then the deadline
        self.assertTrue(any(e["error"] == "deadline 0.01s reached; 1 sessions not read" for e in starved_rows["collector_errors"]), starved_rows["collector_errors"])
        self.assertFalse(any(e["error"].startswith("operator threads:") for e in starved_rows["collector_errors"]))
        # its own reserve: the first session is read, the reserve is spent, the rest are listed unread and said so
        own = self.run_collect("--operator-deadline-s", "0.1")
        ops = own["operator_threads"]
        self.assertEqual([e["session_id"] for e in ops], ["s-orch-dm", "s-orch-none", "s-orch-p0"])
        self.assertNotIn("messages_error", ops[0])
        self.assertEqual([e.get("messages_error") for e in ops[1:]], ["not read: operator deadline 0.1s reached"] * 2)
        self.assertEqual((own["counts"]["operator_read"], own["counts"]["operator_unread"]), (1, 2))
        self.assertTrue(any(e["error"] == "operator threads: deadline 0.1s reached; 2 sessions not read" for e in own["collector_errors"]), own["collector_errors"])
        self.assertEqual(own["counts"]["sessions_read"], self.run_collect("--operator-sessions", "0")["counts"]["sessions_read"])  # row reads untouched
        self.assertEqual(self.run_collect("--operator-deadline-s", "0")["counts"]["operator_unread"], 0)  # 0 = no reserve

    def test_a_long_lived_dm_is_read_newest_first_so_the_ask_at_its_end_is_kept(self):
        """The incident DM was past seq 384 ("Open it" msg 290, "operator ruling B" msg 384). `ncl sessions messages --limit 200`
        returns the OLDEST 200 rows, so without `--reverse` the ask at the end never entered the frame — counted read, no
        error, silently absent. Pass 3 reads newest-first; the row reads keep the plain form."""
        (self.dir / "sessions.json").write_text(json.dumps(SESSIONS + [ORCH_DM]))
        rows = [{"seq": i, "direction": "out", "kind": "chat", "timestamp": f"2026-09-09 {6 + i // 60:02d}:{i % 60:02d}:00", "sender": "orchestrator",
                 "text": ASK_A if i == 300 else f"status line {i}"} for i in range(1, 301)]
        self.fixtures["messages"] = {**MESSAGES, "s-orch-dm": rows}
        out = self.run_collect("--limit", "200")
        dm = next(e for e in out["operator_threads"] if e["session_id"] == "s-orch-dm")
        self.assertNotIn("messages_error", dm)
        self.assertEqual([m["seq"] for m in dm["messages"]], list(range(261, 301)))  # the tail of the NEWEST 200
        self.assertEqual(dm["messages"][-1]["text"], ASK_A)
        calls = self.calls()  # (the Ncl wrapper appends --json to every call)
        self.assertIn(["sessions", "messages", "s-orch-dm", "--limit", "200", "--full", "--reverse", "--json"], calls)
        self.assertIn(["sessions", "messages", "s-arch-f35", "--limit", "200", "--full", "--json"], calls)
        operator_ids = {"s-orch-dm", "s-orch-p0"}  # the pass-3 sessions in this fixture
        self.assertFalse(any("--reverse" in c and c[2] not in operator_ids for c in calls if c[:2] == ["sessions", "messages"]))

    def test_the_autopilots_own_task_series_is_never_an_operator_thread(self):
        """`system:tasks:hermes-ap-*` (install.sh ensure_series) carries the supervise tick's run output, which quotes the
        standing asks and asks the operator nothing itself: never listed, never read."""
        ap = {"id": "s-orch-ap", "agent_group_id": "ag-orch", "thread_id": "system:tasks:hermes-ap-supervise-1a2b", "status": "active",
              "container_status": "stopped", "last_active": "2026-09-09T11:55:00Z"}
        (self.dir / "sessions.json").write_text(json.dumps(SESSIONS + [ORCH_DM, ORCH_TASK, ap]))
        out = self.run_collect()
        self.assertEqual([e["session_id"] for e in out["operator_threads"]], ["s-orch-dm", "s-orch-p0", "s-orch-task"])
        self.assertFalse(any(c[:3] == ["sessions", "messages", "s-orch-ap"] for c in self.calls()))
        self.assertNotIn("system:tasks:hermes-ap-supervise-1a2b", out["other_threads"])

    def test_malformed_transcript_rows_are_skipped_or_coerced_never_fatal(self):
        """A non-dict row or a non-string `text` in one transcript used to abort the whole collector (an empty threads.json,
        every row thread unreadable). Real ncl never emits them — hardening only."""
        (self.dir / "sessions.json").write_text(json.dumps(SESSIONS + [ORCH_DM]))
        self.fixtures["messages"] = {
            **MESSAGES,
            "s-arch-f35": ["not-a-dict", *MESSAGES["s-arch-f35"]],
            "s-orch-dm": ["not-a-dict",
                          {"seq": 1, "direction": "out", "kind": "chat", "timestamp": "2026-09-09 11:00:00", "sender": "orchestrator", "text": 12345},
                          {"seq": 2, "direction": "out", "kind": "chat", "timestamp": "2026-09-09 11:05:00", "sender": "orchestrator", "text": None},
                          {"seq": 3, "direction": "out", "kind": "chat", "timestamp": "2026-09-09 11:15:00", "sender": "orchestrator", "text": ASK_A}],
        }
        out = self.run_collect()
        arch = next(s for s in out["threads"]["LOOP-F35"]["sessions"] if s["id"] == "s-arch-f35")
        self.assertEqual([m["seq"] for m in arch["messages"]], [1, 3])  # the dict rows; the junk dropped, the read counted
        self.assertNotIn("messages_error", arch)
        dm = next(e for e in out["operator_threads"] if e["session_id"] == "s-orch-dm")
        self.assertEqual([m["text"] for m in dm["messages"]], ["12345", "", ASK_A])
        self.assertNotIn("messages_error", dm)
        self.assertEqual((out["counts"]["operator_unread"], out["counts"]["sessions_unread"]), (0, 0))

    def test_missing_session_list_lists_no_operator_threads(self):
        (self.dir / "sessions.json").write_text("{not json")
        out = self.run_collect()
        self.assertEqual((out["operator_threads"], out["counts"]["operator_sessions"]), ([], 0))
