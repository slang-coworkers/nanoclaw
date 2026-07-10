#!/usr/bin/env python3
"""Tests for scan.py — the deterministic supervise-issues classification core.

Each test pins a rule that has a documented production failure in SKILL.md, so a
regression here is a regression of a real incident. Run: python3 test_scan.py
"""

import json
import subprocess
import sys
import unittest
from pathlib import Path

SCAN = str(Path(__file__).resolve().parent / "scan.py")
NOW = "2026-06-26T12:00:00Z"


def run_scan(payload):
    payload.setdefault("now", NOW)
    p = subprocess.run(
        [sys.executable, SCAN],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
    )
    assert p.returncode == 0, f"scan.py exited {p.returncode}: {p.stderr}"
    return json.loads(p.stdout)


def iso(s):
    return s


def row_for(out, thread):
    for r in out["rows"]:
        if r["thread"] == thread:
            return r
    raise AssertionError(f"no row for {thread} in {[r['thread'] for r in out['rows']]}")


class NewChainDiscovery(unittest.TestCase):
    """SKILL.md §1: NEW = {live} - {top-level keys} - {_archived keys}; KEY-based,
    never substring (the #11613 silent-2-days bug)."""

    def test_session_not_in_state_is_new(self):
        out = run_scan({
            "state": {},
            "sessions": [{"id": "s1", "thread_id": "gh-issue-o/r-100", "container_status": "stopped"}],
            "chains": {"gh-issue-o/r-100": {"repo": "o/r", "issue": 100, "sessions": ["s1"], "comments": []}},
        })
        self.assertEqual(row_for(out, "gh-issue-o/r-100")["delta"], "new")
        self.assertEqual(out["summary"]["new"], 1)

    def test_number_in_narrative_prose_does_not_suppress_new(self):
        # The #11613 failure: issue number present in a _meta narrative string,
        # but NOT as a top-level key -> must still be NEW.
        out = run_scan({
            "state": {"_meta": {"tick41": "saw #11613 — no sessions, not a chain"}},
            "sessions": [],
            "chains": {"gh-issue-shader-slang/slang-11613": {
                "repo": "shader-slang/slang", "issue": 11613, "sessions": [], "comments": []}},
        })
        self.assertEqual(row_for(out, "gh-issue-shader-slang/slang-11613")["delta"], "new")

    def test_archived_key_is_not_new(self):
        out = run_scan({
            "state": {"_archived": {"gh-issue-o/r-100": {"reason": "closed-by-us"}}},
            "sessions": [],
            "chains": {"gh-issue-o/r-100": {"repo": "o/r", "issue": 100, "sessions": [], "comments": []}},
        })
        # In _archived -> NOT counted as new (it's a known terminal chain
        # re-surfacing). It has no top-level snapshot, so it reads as 'updated'
        # (a re-opened archived chain genuinely changed) — never 'new'.
        self.assertEqual(row_for(out, "gh-issue-o/r-100")["delta"], "updated")
        self.assertEqual(out["summary"]["new"], 0)


class ActivityByUsClock(unittest.TestCase):
    """SKILL.md §2 [MUST]: the silence clock is BY US; a human comment never
    resets it (the #11594 dark-for-days bug)."""

    def test_human_pokes_do_not_reset_our_clock(self):
        out = run_scan({
            "state": {},
            "sessions": [{"id": "s1", "thread_id": "gh-issue-o/r-11594", "container_status": "stopped"}],
            "chains": {"gh-issue-o/r-11594": {
                "repo": "o/r", "issue": 11594, "sessions": ["s1"],
                "pr": {"number": 11594, "state": "OPEN", "isDraft": False, "fixes_issue": 11594},
                "our_last_outbound": "2026-06-20T00:00:00Z",   # 6 days stale BY US
                "comments": [
                    {"author": "maintainer", "at": "2026-06-26T11:00:00Z", "is_bot": False},  # 1h ago, human
                ],
            }},
        })
        r = row_for(out, "gh-issue-o/r-11594")
        # Ball is ours (human spoke last, no bot reply after) -> awaiting_us + nudge,
        # NOT 'pr_open healthy' despite the fresh human comment.
        self.assertEqual(r["state"], "awaiting_us")
        self.assertTrue(r["needs_nudge"])
        self.assertEqual(r["last_activity_by_us"], "2026-06-20T00:00:00Z")

    def test_our_bot_comment_counts_as_activity(self):
        out = run_scan({
            "state": {},
            "sessions": [{"id": "s1", "thread_id": "gh-issue-o/r-1", "container_status": "running"}],
            "chains": {"gh-issue-o/r-1": {
                "repo": "o/r", "issue": 1, "sessions": ["s1"],
                "comments": [
                    {"author": "nv-slang-bot[bot]", "at": "2026-06-26T11:50:00Z", "is_bot": True},  # 10 min ago
                ],
            }},
        })
        r = row_for(out, "gh-issue-o/r-1")
        self.assertEqual(r["ball"], "human")       # we spoke last
        self.assertFalse(r["needs_nudge"])
        self.assertEqual(r["last_activity_by_us"], "2026-06-26T11:50:00Z")


class BallDirection(unittest.TestCase):
    """SKILL.md §2 [MUST]: awaiting_us vs awaiting_human discriminator = who spoke last."""

    def test_user_pat_bot_reply_counts_as_us(self):
        # Bot replied under the user PAT (no [bot] suffix) AFTER the human ->
        # ball is human (we answered), not ours.
        out = run_scan({
            "state": {},
            "sessions": [{"id": "s1", "thread_id": "gh-issue-o/r-2", "container_status": "stopped"}],
            "chains": {"gh-issue-o/r-2": {
                "repo": "o/r", "issue": 2, "sessions": ["s1"],
                "comments": [
                    {"author": "human", "at": "2026-06-26T10:00:00Z", "is_bot": False},
                    {"author": "nv-slang-bot", "at": "2026-06-26T10:30:00Z"},  # no is_bot -> matched by login
                ],
            }},
        })
        self.assertEqual(row_for(out, "gh-issue-o/r-2")["ball"], "human")

    def test_pending_ask_user_is_awaiting_human(self):
        out = run_scan({
            "state": {},
            "sessions": [{"id": "s1", "thread_id": "gh-issue-o/r-3", "container_status": "stopped"}],
            "chains": {"gh-issue-o/r-3": {
                "repo": "o/r", "issue": 3, "sessions": ["s1"], "comments": [],
                "pending_ask_user": True,
            }},
        })
        self.assertEqual(row_for(out, "gh-issue-o/r-3")["state"], "awaiting_human")


class PrIssueResolution(unittest.TestCase):
    """SKILL.md §1: trust the PR body's Fixes #N; flag mis-threaded reused sessions."""

    def test_mis_threaded_flagged(self):
        out = run_scan({
            "state": {},
            "sessions": [{"id": "s1", "thread_id": "gh-issue-o/r-100", "container_status": "stopped"}],
            "chains": {"gh-issue-o/r-100": {
                "repo": "o/r", "issue": 100, "sessions": ["s1"],
                "pr": {"number": 200, "state": "OPEN", "isDraft": True, "fixes_issue": 999},
                "comments": [],
            }},
        })
        self.assertTrue(row_for(out, "gh-issue-o/r-100")["mis_threaded"])

    def test_matching_fixes_not_mis_threaded(self):
        out = run_scan({
            "state": {},
            "sessions": [],
            "chains": {"gh-issue-o/r-100": {
                "repo": "o/r", "issue": 100, "sessions": [],
                "pr": {"number": 200, "state": "OPEN", "isDraft": True, "fixes_issue": 100},
                "comments": [],
            }},
        })
        self.assertFalse(row_for(out, "gh-issue-o/r-100")["mis_threaded"])


class StateAndEscalation(unittest.TestCase):
    def test_silent_escalates_after_4h(self):
        out = run_scan({
            "state": {},
            "sessions": [{"id": "s1", "thread_id": "gh-issue-o/r-5", "container_status": "stopped"}],
            "chains": {"gh-issue-o/r-5": {
                "repo": "o/r", "issue": 5, "sessions": ["s1"],
                "our_last_outbound": "2026-06-26T07:00:00Z",  # 5h ago, no comments
                "comments": [],
            }},
        })
        r = row_for(out, "gh-issue-o/r-5")
        self.assertEqual(r["state"], "silent")
        self.assertTrue(r["escalate"])
        self.assertEqual(out["summary"]["escalate"], 1)

    def test_fresh_working_session_left_alone(self):
        out = run_scan({
            "state": {},
            "sessions": [{"id": "s1", "thread_id": "gh-issue-o/r-6", "container_status": "running"}],
            "chains": {"gh-issue-o/r-6": {
                "repo": "o/r", "issue": 6, "sessions": ["s1"],
                "our_last_outbound": "2026-06-26T11:40:00Z",  # 20 min ago
                "comments": [],
            }},
        })
        r = row_for(out, "gh-issue-o/r-6")
        self.assertFalse(r["needs_nudge"])
        self.assertIn(r["state"], ("working", "pr_open"))


class DeltaAndState(unittest.TestCase):
    def test_unchanged_chain_is_same(self):
        prior = {
            "gh-issue-o/r-7": {
                "lastState": "awaiting_human", "lastActivityAt": "2026-06-26T11:50:00Z",
                "lastPrState": None, "nudgedAt": ["2026-06-01T00:00:00Z"],
            }
        }
        out = run_scan({
            "state": prior,
            "sessions": [{"id": "s1", "thread_id": "gh-issue-o/r-7", "container_status": "running"}],
            "chains": {"gh-issue-o/r-7": {
                "repo": "o/r", "issue": 7, "sessions": ["s1"],
                "comments": [{"author": "nv-slang-bot[bot]", "at": "2026-06-26T11:50:00Z", "is_bot": True}],
            }},
        })
        self.assertEqual(row_for(out, "gh-issue-o/r-7")["delta"], "same")
        # Durable bookkeeping (nudgedAt) survives into next state.
        self.assertEqual(out["state"]["gh-issue-o/r-7"]["nudgedAt"], ["2026-06-01T00:00:00Z"])

    def test_state_preserves_archived_block(self):
        out = run_scan({
            "state": {"_archived": {"gh-issue-o/r-9": {"reason": "x"}}},
            "sessions": [],
            "chains": {},
        })
        self.assertIn("_archived", out["state"])
        self.assertEqual(out["summary"]["in_flight"], 0)


class Robustness(unittest.TestCase):
    def test_missing_timestamps_do_not_crash(self):
        out = run_scan({
            "state": {},
            "sessions": [{"id": "s1", "thread_id": "gh-issue-o/r-8", "container_status": "stopped"}],
            "chains": {"gh-issue-o/r-8": {
                "repo": "o/r", "issue": 8, "sessions": ["s1"],
                "our_last_outbound": None, "comments": [],
            }},
        })
        # No activity, no comments -> dispatched (brand new), no nudge.
        self.assertEqual(row_for(out, "gh-issue-o/r-8")["state"], "dispatched")

    def test_empty_input(self):
        out = run_scan({"state": {}, "sessions": [], "chains": {}})
        self.assertEqual(out["rows"], [])
        self.assertEqual(out["summary"]["in_flight"], 0)


class NextStepOwnership(unittest.TestCase):
    """SKILL.md §2: bot-last is ambiguous. A fixer-owned, artifact-less chain that
    has gone dark is a promise WE owe, not a handoff — nudge it (slang#12002, where
    the fixer edited code, said 'waiting on the build monitor', idle-exited, and was
    never woken because the classifier read bot-last as awaiting_human forever)."""

    def _fixer_chain(self, disp=None, pr=None, folder="slang-fixer"):
        # bot spoke last 5 days ago (ball=human), then silence. No human after.
        return {
            "state": {},
            "sessions": [{"id": "s1", "thread_id": "gh-issue-o/r-12002",
                          "container_status": "stopped", "group_folder": folder}],
            "chains": {"gh-issue-o/r-12002": {
                "repo": "o/r", "issue": 12002, "sessions": ["s1"],
                "our_last_outbound": "2026-06-21T12:00:00Z",  # 5 days stale BY US
                "pr": pr, "disposition": disp,
                "comments": [
                    {"author": "nv-slang-bot[bot]", "at": "2026-06-21T12:00:00Z", "is_bot": True},
                ],
            }},
        }

    def test_dark_fixer_no_pr_is_awaiting_us(self):
        r = row_for(run_scan(self._fixer_chain()), "gh-issue-o/r-12002")
        self.assertEqual(r["state"], "awaiting_us")   # was awaiting_human (the bug)
        self.assertTrue(r["needs_nudge"])
        self.assertEqual(r["ball"], "human")          # bot still spoke last

    def test_human_owned_disposition_stays_parked(self):
        r = row_for(run_scan(self._fixer_chain(disp="active: human-debate")),
                    "gh-issue-o/r-12002")
        self.assertEqual(r["state"], "awaiting_human")
        self.assertFalse(r["needs_nudge"])

    def test_triage_only_no_fixer_stays_parked(self):
        # A triager-owned bot-last chain legitimately awaits a human — don't regress it.
        r = row_for(run_scan(self._fixer_chain(folder="slang-triager")),
                    "gh-issue-o/r-12002")
        self.assertEqual(r["state"], "awaiting_human")
        self.assertFalse(r["needs_nudge"])

    def test_fixer_with_open_pr_stays_parked(self):
        # PR exists -> artifact present; CI/Step 2b owns the nudge, not this path.
        pr = {"number": 999, "state": "OPEN", "isDraft": True, "fixes_issue": 12002}
        r = row_for(run_scan(self._fixer_chain(pr=pr)), "gh-issue-o/r-12002")
        self.assertEqual(r["state"], "awaiting_human")
        self.assertFalse(r["needs_nudge"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
