#!/usr/bin/env python3
"""Tests for supervise-gate.py — the hourly zero-token gate of /supervise-issues.

Each test runs the gate as the task runner does (a subprocess whose LAST stdout
line must be `{"wakeAgent": <bool>, "data": …}` and whose exit code must be 0) on
a fixture payload served by SUPERVISE_GATE_PULL_CMD, and pins one behaviour:

  * nothing stalled            -> stays asleep (zero tokens)
  * a chain past the nudge or escalate threshold -> wakes, once per flag
  * the 12-hour full pass is due -> wakes
  * the pull overruns its time box or fails -> killed, recorded as degraded,
    still valid JSON and exit 0; the streak wakes the agent once
  * a chain the incremental pull marked cache_cold never wakes the agent

Run: python3 test_supervise_gate.py
"""

import datetime as dt
import fcntl
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

GATE = Path(__file__).resolve().parent / "supervise-gate.py"

QUIET = "gh-issue-acme/widget-100"     # triage-only, bot spoke last: awaiting_human
STALLED = "gh-issue-acme/widget-200"   # fixer-owned, no PR, silent 2 h: awaiting_us -> nudge
SILENT = "gh-issue-acme/widget-300"    # no conversation, silent 5 h: silent -> nudge + escalate


def ago(**kw) -> str:
    return (dt.datetime.now(dt.timezone.utc) - dt.timedelta(**kw)).strftime("%Y-%m-%dT%H:%M:%SZ")


def session_id(hours_ago: float, suffix: str) -> str:
    ms = int((time.time() - hours_ago * 3600) * 1000)
    return f"sess-{ms}-{suffix}"


def chain(thread, sessions, **fields):
    repo, num = thread[len("gh-issue-"):].rsplit("-", 1)
    c = {"repo": repo, "issue": int(num), "sessions": sessions, "issue_open": True,
         "our_last_outbound": None, "our_last_push": None, "pr": None, "comments": [],
         "pending_ask_user": False}
    c.update(fields)
    return c


def payload(*kinds, cold=()):
    """A pull-universe payload holding the named fixture chains."""
    sessions, chains = [], {}
    if "quiet" in kinds:
        sid = session_id(30, "q")
        sessions.append({"id": sid, "thread_id": QUIET, "container_status": "stopped",
                         "group_folder": "slang-triager", "cost_status": "ok"})
        chains[QUIET] = chain(QUIET, [sid], our_last_outbound=ago(minutes=20), comments=[
            {"author": "maintainer", "at": ago(hours=3), "is_bot": False},
            {"author": "nv-slang-bot[bot]", "at": ago(minutes=20), "is_bot": True}])
    if "stalled" in kinds:
        sid = session_id(30, "f")
        sessions.append({"id": sid, "thread_id": STALLED, "container_status": "stopped",
                         "group_folder": "slang-fixer", "cost_status": "ok"})
        chains[STALLED] = chain(STALLED, [sid], our_last_outbound=ago(hours=2), comments=[
            {"author": "nv-slang-bot[bot]", "at": ago(hours=2), "is_bot": True}])
    if "silent" in kinds:
        sid = session_id(30, "s")
        sessions.append({"id": sid, "thread_id": SILENT, "container_status": "stopped",
                         "group_folder": "slang-fixer", "cost_status": "ok"})
        chains[SILENT] = chain(SILENT, [sid], our_last_outbound=ago(hours=5))
    for thread in cold:
        chains[thread]["cache_cold"] = True
    return {"now": ago(), "state": {}, "sessions": sessions, "chains": chains}


class GateHarness(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.agent = Path(self.tmp.name)
        self.gate_dir = self.agent / ".supervise-gate"
        self.payload_file = self.agent / "payload.json"
        self.env = dict(os.environ, SUPERVISE_GATE_AGENT_DIR=str(self.agent),
                        SUPERVISE_GATE_PULL_CMD=f"cat {self.payload_file}")
        # A tick ran an hour ago, so the full pass is not due unless a test says so.
        self.set_state(last_wake_at=ago(hours=1))

    def tearDown(self):
        self.tmp.cleanup()

    def set_state(self, **fields):
        self.gate_dir.mkdir(parents=True, exist_ok=True)
        state = self.state()
        state.update(fields)
        (self.gate_dir / "state.json").write_text(json.dumps(state))

    def state(self):
        path = self.gate_dir / "state.json"
        return json.loads(path.read_text()) if path.exists() else {}

    def serve(self, body):
        self.payload_file.write_text(json.dumps(body))

    def gate(self, *args, **env):
        """Run the gate like the task runner and return the parsed gate JSON."""
        started = time.monotonic()
        r = subprocess.run([sys.executable, str(GATE), *args], capture_output=True, text=True,
                           env={**self.env, **env}, timeout=60, check=False)
        self.elapsed = time.monotonic() - started
        self.assertEqual(r.returncode, 0, r.stderr)
        lines = r.stdout.strip().splitlines()
        self.assertEqual(len(lines), 1, f"stdout must be the gate JSON alone: {r.stdout!r}")
        out = json.loads(lines[-1])
        self.assertIsInstance(out["wakeAgent"], bool)
        self.assertIsInstance(out["data"], dict)
        return out


class QuietFleet(GateHarness):
    def test_nothing_stalled_stays_asleep(self):
        self.serve(payload("quiet"))
        out = self.gate()
        self.assertFalse(out["wakeAgent"])
        self.assertEqual(out["data"]["reasons"], [])
        self.assertEqual(out["data"]["chains"]["in_flight"], 1)
        # The run is recorded like the worktree GC's.
        record = json.loads((self.gate_dir / "last-run.json").read_text())
        self.assertFalse(record["wake"])
        self.assertEqual(len((self.gate_dir / "history.log").read_text().splitlines()), 1)
        self.assertEqual(self.state()["failures"], 0)

    def test_dry_run_writes_no_state(self):
        (self.gate_dir / "state.json").unlink()
        self.serve(payload("quiet"))
        self.gate("--dry-run")
        self.assertFalse((self.gate_dir / "state.json").exists())
        self.assertFalse((self.gate_dir / "history.log").exists())


class StalledChains(GateHarness):
    def test_chain_past_nudge_threshold_wakes(self):
        self.serve(payload("quiet", "stalled"))
        out = self.gate()
        self.assertTrue(out["wakeAgent"])
        self.assertEqual(out["data"]["reasons"], ["nudge"])
        self.assertEqual(out["data"]["nudge"], [STALLED])
        self.assertEqual(out["data"]["escalate"], [])

    def test_chain_past_escalate_threshold_wakes(self):
        self.serve(payload("silent"))
        out = self.gate()
        self.assertTrue(out["wakeAgent"])
        self.assertEqual(out["data"]["reasons"], ["nudge", "escalate"])
        self.assertEqual(out["data"]["escalate"], [SILENT])

    def test_a_flag_wakes_once_until_it_clears(self):
        # A tick that saw the flag and sent nothing (a judged false positive) does
        # not get woken again every hour for the same flag.
        self.serve(payload("stalled"))
        self.assertTrue(self.gate()["wakeAgent"])
        again = self.gate()
        self.assertFalse(again["wakeAgent"])
        self.assertEqual(again["data"]["already_presented"], 1)
        # The chain recovers, then stalls again: that is a new episode.
        self.serve(payload("quiet"))
        self.assertFalse(self.gate()["wakeAgent"])
        self.serve(payload("stalled"))
        self.assertTrue(self.gate()["wakeAgent"])

    def test_cold_chain_never_wakes(self):
        self.serve(payload("stalled", cold=[STALLED]))
        out = self.gate()
        self.assertFalse(out["wakeAgent"])
        self.assertEqual(out["data"]["chains"]["cold"], 1)


class FullPass(GateHarness):
    def test_full_pass_due_wakes(self):
        self.set_state(last_wake_at=ago(hours=13))
        self.serve(payload("quiet"))
        out = self.gate()
        self.assertTrue(out["wakeAgent"])
        self.assertEqual(out["data"]["reasons"], ["full-pass"])
        # The wake restarts the 12-hour clock.
        self.assertFalse(self.gate()["wakeAgent"])

    def test_first_run_reads_the_last_tick_from_supervisor_state(self):
        (self.gate_dir / "state.json").unlink()
        memory = self.agent / "memory"
        memory.mkdir()
        (memory / "supervisor-state.json").write_text(json.dumps({"_meta": {"ran_at": ago(hours=2)}}))
        self.serve(payload("quiet"))
        self.assertFalse(self.gate()["wakeAgent"])

    def test_first_run_with_no_history_wakes(self):
        (self.gate_dir / "state.json").unlink()
        self.serve(payload("quiet"))
        self.assertEqual(self.gate()["data"]["reasons"], ["full-pass"])


class DegradedPull(GateHarness):
    def test_pull_past_the_time_box_is_killed_and_degrades_safely(self):
        marker = self.agent / "pull-finished"
        out = self.gate(SUPERVISE_GATE_PULL_CMD=f"sleep 4; touch {marker}",
                        SUPERVISE_GATE_PULL_HARD_S="1")
        self.assertFalse(out["wakeAgent"])
        self.assertIn("time box", out["data"]["degraded"])
        self.assertLess(self.elapsed, 4, "the gate must not wait for the pull past its hard limit")
        time.sleep(4.5)
        self.assertFalse(marker.exists(), "the pull's process group must be killed, not orphaned")
        self.assertEqual(self.state()["failures"], 1)
        self.assertIn("degraded=", (self.gate_dir / "history.log").read_text())

    def test_degraded_run_keeps_presented_flags(self):
        self.serve(payload("stalled"))
        self.assertTrue(self.gate()["wakeAgent"])
        self.gate(SUPERVISE_GATE_PULL_CMD="exit 1")
        self.assertIn(f"{STALLED}|nudge", self.state()["presented"])
        # Back to a good pull: the flag was already shown, so no wake.
        self.assertFalse(self.gate()["wakeAgent"])

    def test_failure_streak_wakes_once(self):
        wakes = [self.gate(SUPERVISE_GATE_PULL_CMD="echo boom >&2; exit 1")["wakeAgent"] for _ in range(4)]
        self.assertEqual(wakes, [False, False, True, False])
        self.assertEqual(self.state()["failures"], 4)
        self.serve(payload("quiet"))
        self.gate()
        self.assertEqual(self.state()["failures"], 0)

    def test_full_pass_still_fires_when_the_pull_fails(self):
        self.set_state(last_wake_at=ago(hours=13))
        out = self.gate(SUPERVISE_GATE_PULL_CMD="exit 1")
        self.assertTrue(out["wakeAgent"])
        self.assertEqual(out["data"]["reasons"], ["full-pass"])

    def test_garbage_payload_degrades(self):
        out = self.gate(SUPERVISE_GATE_PULL_CMD="echo not-json")
        self.assertFalse(out["wakeAgent"])
        self.assertIn("not JSON", out["data"]["degraded"])

    def test_concurrent_run_is_skipped(self):
        self.serve(payload("stalled"))
        with open(self.gate_dir / "lock", "w") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            out = self.gate()
        self.assertFalse(out["wakeAgent"])
        self.assertIn("lock", out["data"]["skipped"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
