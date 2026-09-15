#!/usr/bin/env python3
"""Tests for scan.py — the deterministic supervise-issues classification core.

Each test pins a rule that has a documented production failure in SKILL.md, so a
regression here is a regression of a real incident. Run: python3 test_scan.py
"""

from __future__ import annotations

import json
import subprocess
import sys
import unittest
from datetime import datetime
from pathlib import Path
from typing import ClassVar

SCAN = str(Path(__file__).resolve().parent / "scan.py")
NOW = "2026-06-26T12:00:00Z"


def run_scan(payload):
    payload.setdefault("now", NOW)
    p = subprocess.run(
        [sys.executable, SCAN],
        input=json.dumps(payload),
        capture_output=True,
        text=True,
        check=False,  # the assert below is the exit-code check
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


def _sid_at(iso):
    """A session id whose embedded ms encodes `iso` — scan derives the dispatch
    clock from the oldest `sess-<ms>-<rand>` id."""
    ms = int(datetime.fromisoformat(iso.replace("Z", "+00:00")).timestamp() * 1000)
    return f"sess-{ms}-tstz"


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

    def test_bounced_dispatch_zero_activity_is_nudged(self):
        # slang#12165: a triage dispatch that bounced (bounced-transient, zero
        # outbound, no issue comment) held a session ~7h with NO activity-by-us and
        # no artifact, while a retry container was still 'running' (idle). It must
        # be nudged + escalated on the dispatch clock — not read as fresh/RUNNING
        # forever. Liveness (container_status=='running') is not progress.
        sid = _sid_at("2026-06-26T05:00:00Z")  # dispatched ~7h before NOW
        out = run_scan({
            "state": {},
            "sessions": [{"id": sid, "thread_id": "gh-issue-o/r-12165",
                          "container_status": "running", "group_folder": "slang-triager"}],
            "chains": {"gh-issue-o/r-12165": {
                "repo": "o/r", "issue": 12165, "sessions": [sid],
                "our_last_outbound": None, "our_last_push": None,
                "comments": [], "pr": None, "issue_open": True,
            }},
        })
        r = row_for(out, "gh-issue-o/r-12165")
        self.assertTrue(r["needs_nudge"], r)
        self.assertEqual(r["action"], "nudge")
        self.assertEqual(r["state"], "silent")
        self.assertTrue(r["escalate"], r)
        self.assertEqual(out["summary"]["escalate"], 1)

    def test_fresh_dispatch_zero_activity_left_alone(self):
        # The mirror guard: a genuinely fresh dispatch (< working window) with no
        # activity yet must NOT draw a false nudge from the dispatch-age fallback.
        sid = _sid_at("2026-06-26T11:45:00Z")  # dispatched 15 min before NOW
        out = run_scan({
            "state": {},
            "sessions": [{"id": sid, "thread_id": "gh-issue-o/r-778",
                          "container_status": "running", "group_folder": "slang-triager"}],
            "chains": {"gh-issue-o/r-778": {
                "repo": "o/r", "issue": 778, "sessions": [sid],
                "our_last_outbound": None, "our_last_push": None,
                "comments": [], "pr": None, "issue_open": True,
            }},
        })
        r = row_for(out, "gh-issue-o/r-778")
        self.assertFalse(r["needs_nudge"], r)
        self.assertEqual(r["non_nudge_reason"], "fresh-dispatch", r)
        self.assertEqual(r["state"], "dispatched", r)


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

    def test_pr_keyed_chain_is_not_false_flipped(self):
        # Enrichment contract: a chain keyed on a PR NUMBER (not an issue) must
        # arrive with chain["pr"] populated (pull-universe stamps it from the
        # issueOrPullRequest PullRequest arm as self_pr). If enrichment ever
        # regresses and leaves pr=None on such a chain, we_owe_next_step would
        # wrongly flip a bot-last, fixer-owned PR chain to awaiting_us and nudge
        # a PR that already exists. Pin the with-pr behavior as the guard.
        pr = {"number": 12002, "state": "OPEN", "isDraft": True,
              "fixes_issue": 12002, "body_has_fixes": True}
        r = row_for(run_scan(self._fixer_chain(pr=pr)), "gh-issue-o/r-12002")
        self.assertEqual(r["pr"], 12002)
        self.assertEqual(r["state"], "awaiting_human")
        self.assertFalse(r["needs_nudge"])


class ActionPlan(unittest.TestCase):
    """SKILL.md §3 mechanical enforcement: scan.py emits a per-row `action`
    that is a STRICT 1:1 with needs_nudge — 'nudge' | 'none', never 'suppress'.
    A nudge row can never be turned off downstream (the prose-override hole that
    stranded #12097; PR #901's wording alone was insufficient). Non-nudge rows
    carry an enum-like `non_nudge_reason`, never free prose. `summary.must_nudge`
    is the reconciliation target for the §3 fails-loudly check."""

    def _fixer_chain(self, disp=None, pr=None, folder="slang-fixer"):
        return {
            "state": {},
            "sessions": [{"id": "s1", "thread_id": "gh-issue-o/r-12002",
                          "container_status": "stopped", "group_folder": folder}],
            "chains": {"gh-issue-o/r-12002": {
                "repo": "o/r", "issue": 12002, "sessions": ["s1"],
                "our_last_outbound": "2026-06-21T12:00:00Z",
                "pr": pr, "disposition": disp,
                "comments": [
                    {"author": "nv-slang-bot[bot]", "at": "2026-06-21T12:00:00Z", "is_bot": True},
                ],
            }},
        }

    def test_every_row_has_action(self):
        out = run_scan(self._fixer_chain())
        for r in out["rows"]:
            self.assertIn(r["action"], ("nudge", "none"))
            # No 'suppress' escape hatch exists anywhere.
            self.assertNotEqual(r["action"], "suppress")

    def test_needs_nudge_iff_action_nudge(self):
        # The invariant, pinned across a mixed board: action=='nudge' <=> needs_nudge.
        out = run_scan(self._fixer_chain())
        for r in out["rows"]:
            self.assertEqual(r["action"] == "nudge", bool(r["needs_nudge"]))

    def test_nudge_row_has_no_non_nudge_reason(self):
        r = row_for(run_scan(self._fixer_chain()), "gh-issue-o/r-12002")
        self.assertEqual(r["action"], "nudge")
        self.assertIsNone(r["non_nudge_reason"])

    def test_human_owned_is_action_none_with_enum_reason(self):
        # Human-owned disposition is NOT a suppressed nudge — it never becomes a
        # nudge row. It surfaces as action='none' with a deterministic token.
        r = row_for(run_scan(self._fixer_chain(disp="active: human-debate")),
                    "gh-issue-o/r-12002")
        self.assertFalse(r["needs_nudge"])
        self.assertEqual(r["action"], "none")
        self.assertEqual(r["non_nudge_reason"], "human-owned:human-debate")

    def test_must_nudge_counts_nudge_rows(self):
        out = run_scan(self._fixer_chain())
        n = sum(1 for r in out["rows"] if r["action"] == "nudge")
        self.assertEqual(out["summary"]["must_nudge"], n)
        # By construction must_nudge == needs_nudge (action is 1:1).
        self.assertEqual(out["summary"]["must_nudge"], out["summary"]["needs_nudge"])


class StoppedErroredBounce(unittest.TestCase):
    """The #12097 shape: a fixer-owned, no-PR chain whose owning container is
    STOPPED and whose last outbound classed as a transient error (an a2a handoff
    that bounced on an auth outage). This must be action='nudge' even if the
    silence clock is still fresh — the container will not self-recover. Additive
    to we_owe_next_step; complements the host-side a2a redrive."""

    def _bounced_chain(self, error_class: str | None = "transient", container_status="stopped",
                       our_last_outbound="2026-06-26T11:58:00Z"):
        # our_last_outbound only 2 min stale (WELL inside SILENT_S) — proves the
        # nudge comes from the bounce limb, not the silence clock. Stopped-ness is
        # read from the session's container_status (as in production), not a
        # chain-level flag.
        return {
            "state": {},
            "sessions": [{"id": "s1", "thread_id": "gh-issue-shader-slang/slang-12097",
                          "container_status": container_status, "group_folder": "slang-fixer"}],
            "chains": {"gh-issue-shader-slang/slang-12097": {
                "repo": "shader-slang/slang", "issue": 12097, "sessions": ["s1"],
                "our_last_outbound": our_last_outbound,
                "pr": None, "disposition": None,
                "last_outbound_error_class": error_class,
                "comments": [
                    {"author": "nv-slang-bot[bot]", "at": our_last_outbound, "is_bot": True},
                ],
            }},
        }

    def test_bounced_fixer_chain_is_nudged_even_when_fresh(self):
        r = row_for(run_scan(self._bounced_chain()), "gh-issue-shader-slang/slang-12097")
        self.assertEqual(r["state"], "awaiting_us")
        self.assertTrue(r["needs_nudge"])
        self.assertEqual(r["action"], "nudge")
        self.assertEqual(r["last_outbound_error_class"], "transient")
        self.assertEqual(r["stopped_session_count"], 1)

    def test_no_error_class_does_not_flip_fresh_chain(self):
        # A stopped session with a clean (non-error) last outbound and fresh
        # silence must NOT be nudged by the bounce limb — only by the clock.
        r = row_for(run_scan(self._bounced_chain(error_class=None)),
                    "gh-issue-shader-slang/slang-12097")
        self.assertFalse(r["needs_nudge"])
        self.assertEqual(r["action"], "none")


class CostStopped(unittest.TestCase):
    """A session that hit its Tier-2 cost ceiling is hard-blocked pending a
    human Continue/Stop decision (the dashboard's cost-approval card) —
    `cost_status` on the session row, stamped by pull-universe.sh via `ncl
    cost-cap status`. No nudge can un-stick this, so it must NEVER reach
    needs_nudge=True from ANY of the three ball branches classify() would
    otherwise take. Without this short-circuit, a cost-stopped chain reads as
    an ordinary silent/awaiting_us chain once enough time passes — the exact
    supervise-issues bug this pins."""

    def test_cost_stopped_session_silent_ball_none_is_not_nudged(self):
        # Mirrors test_silent_escalates_after_4h's shape (silent 5h, no
        # comments) but the session is cost_status='stopped' — must classify
        # as cost_stopped, not silent, and must NOT be nudged or escalated.
        out = run_scan({
            "state": {},
            "sessions": [{"id": "s1", "thread_id": "gh-issue-o/r-cs1",
                          "container_status": "running", "cost_status": "stopped"}],
            "chains": {"gh-issue-o/r-cs1": {
                "repo": "o/r", "issue": 1, "sessions": ["s1"],
                # 5h stale by us -> would be 'silent' + escalate=True otherwise.
                "our_last_outbound": "2026-06-26T07:00:00Z",
                "comments": [],
            }},
        })
        r = row_for(out, "gh-issue-o/r-cs1")
        self.assertEqual(r["state"], "cost_stopped")
        self.assertFalse(r["needs_nudge"], r)
        self.assertEqual(r["action"], "none")
        self.assertEqual(r["non_nudge_reason"], "cost-stopped")
        self.assertFalse(r["escalate"], r)  # never escalated — dashboard owns this decision
        self.assertEqual(out["summary"]["needs_nudge"], 0)
        self.assertEqual(out["summary"]["escalate"], 0)
        self.assertEqual(out["summary"]["cost_stopped"], 1)

    def test_cost_stopped_overrides_ball_ours_immediate_nudge(self):
        # Without the short-circuit, ball=='ours' (human spoke last,
        # unanswered) nudges IMMEDIATELY regardless of staleness (SKILL.md §2
        # [MUST]). A cost-stopped session must still not be nudged here.
        out = run_scan({
            "state": {},
            "sessions": [{"id": "s1", "thread_id": "gh-issue-o/r-cs2",
                          "container_status": "running", "cost_status": "stopped"}],
            "chains": {"gh-issue-o/r-cs2": {
                "repo": "o/r", "issue": 2, "sessions": ["s1"],
                "our_last_outbound": "2026-06-20T00:00:00Z",
                "comments": [
                    {"author": "maintainer", "at": "2026-06-26T11:59:00Z", "is_bot": False},  # 1 min ago
                ],
            }},
        })
        r = row_for(out, "gh-issue-o/r-cs2")
        self.assertEqual(r["ball"], "ours")
        self.assertEqual(r["state"], "cost_stopped")
        self.assertFalse(r["needs_nudge"], r)

    def test_cost_stopped_overrides_fixer_owed_promise(self):
        # Without the short-circuit this exact shape is we_owe_next_step's own
        # carve-out (bot-last, fixer-owned, no PR, silent >= 60 min) ->
        # awaiting_us + nudge (see NextStepOwnership.test_dark_fixer_no_pr_is_awaiting_us,
        # same chain shape). A cost-stopped session on the chain must win.
        out = run_scan({
            "state": {},
            "sessions": [{"id": "s1", "thread_id": "gh-issue-o/r-cs3",
                          "container_status": "stopped", "group_folder": "slang-fixer",
                          "cost_status": "stopped"}],
            "chains": {"gh-issue-o/r-cs3": {
                "repo": "o/r", "issue": 3, "sessions": ["s1"],
                "our_last_outbound": "2026-06-21T12:00:00Z",  # 5 days stale
                "pr": None, "disposition": None,
                "comments": [
                    {"author": "nv-slang-bot[bot]", "at": "2026-06-21T12:00:00Z", "is_bot": True},
                ],
            }},
        })
        r = row_for(out, "gh-issue-o/r-cs3")
        self.assertEqual(r["ball"], "human")
        self.assertEqual(r["state"], "cost_stopped")
        self.assertFalse(r["needs_nudge"], r)

    def test_only_literal_stopped_status_triggers(self):
        # 'ok' | 'warn' | 'escalated' | 'unknown' | absent must NOT trigger —
        # only the literal 'stopped' value means the session cannot act.
        for status in ("ok", "warn", "escalated", "unknown", None):
            sess = {"id": "s1", "thread_id": "gh-issue-o/r-cs4", "container_status": "running"}
            if status is not None:
                sess["cost_status"] = status
            out = run_scan({
                "state": {},
                "sessions": [sess],
                "chains": {"gh-issue-o/r-cs4": {
                    "repo": "o/r", "issue": 4, "sessions": ["s1"],
                    "our_last_outbound": "2026-06-26T11:50:00Z", "comments": [],
                }},
            })
            r = row_for(out, "gh-issue-o/r-cs4")
            self.assertNotEqual(r["state"], "cost_stopped", f"status={status!r} must not trigger cost_stopped")

    def test_any_session_on_chain_stopped_is_enough(self):
        # A chain can hold more than one session; ANY of them being
        # cost-stopped blocks the whole chain (any_session_cost_stopped).
        out = run_scan({
            "state": {},
            "sessions": [
                {"id": "s1", "thread_id": "gh-issue-o/r-cs5", "container_status": "running", "cost_status": "ok"},
                {"id": "s2", "thread_id": "gh-issue-o/r-cs5", "container_status": "running", "cost_status": "stopped"},
            ],
            "chains": {"gh-issue-o/r-cs5": {
                "repo": "o/r", "issue": 5, "sessions": ["s1", "s2"],
                "our_last_outbound": None, "comments": [],
            }},
        })
        r = row_for(out, "gh-issue-o/r-cs5")
        self.assertEqual(r["state"], "cost_stopped")

    def test_non_cost_stopped_rows_always_carry_needs_cost_notice_false(self):
        out = run_scan({
            "state": {},
            "sessions": [{"id": "s1", "thread_id": "gh-issue-o/r-cs8", "container_status": "running"}],
            "chains": {"gh-issue-o/r-cs8": {
                "repo": "o/r", "issue": 8, "sessions": ["s1"],
                "our_last_outbound": "2026-06-26T11:55:00Z", "comments": [],
            }},
        })
        r = row_for(out, "gh-issue-o/r-cs8")
        self.assertIn("needs_cost_notice", r)
        self.assertFalse(r["needs_cost_notice"])

    def test_needs_cost_notice_true_on_first_tick_only(self):
        # First tick: chain enters cost_stopped -> needs_cost_notice True (the
        # trigger for the one-line factual GitHub comment). Second tick, the
        # session is STILL stopped and nothing else changed -> needs_cost_notice
        # False (the dedup gate) even though state is still cost_stopped.
        payload1 = {
            "state": {},
            "sessions": [{"id": "s1", "thread_id": "gh-issue-o/r-cs6",
                          "container_status": "running", "cost_status": "stopped"}],
            "chains": {"gh-issue-o/r-cs6": {
                "repo": "o/r", "issue": 6, "sessions": ["s1"],
                "our_last_outbound": "2026-06-26T09:00:00Z", "comments": [],
            }},
        }
        out1 = run_scan(payload1)
        r1 = row_for(out1, "gh-issue-o/r-cs6")
        self.assertEqual(r1["delta"], "new")
        self.assertTrue(r1["needs_cost_notice"], r1)

        # Tick 2 gets the state tick 1 produced; the chain data is identical
        # (realistic: a cost-stopped container cannot produce new outbound).
        out2 = run_scan({**payload1, "state": out1["state"]})
        r2 = row_for(out2, "gh-issue-o/r-cs6")
        self.assertEqual(r2["state"], "cost_stopped")
        self.assertEqual(r2["delta"], "same")
        self.assertFalse(r2["needs_cost_notice"], r2)

    def test_needs_cost_notice_rearms_after_resume_and_re_stop(self):
        # Tick 1: cost_stopped -> notice due. Tick 2: a human clicked Continue,
        # the session resumed and answered (ball flips, cost_status != 'stopped')
        # -> no longer cost_stopped, no notice. Tick 3: hits the ceiling again
        # -> cost_stopped again, and needs_cost_notice must be True again (a
        # NEW stop episode) — not permanently suppressed by tick 1's notice.
        thread = "gh-issue-o/r-cs7"
        sess_stopped = {"id": "s1", "thread_id": thread, "container_status": "running",
                         "cost_status": "stopped"}
        base_chain = {"repo": "o/r", "issue": 7, "sessions": ["s1"], "comments": []}

        out1 = run_scan({
            "state": {}, "sessions": [sess_stopped],
            "chains": {thread: {**base_chain, "our_last_outbound": "2026-06-26T09:00:00Z"}},
        })
        self.assertTrue(row_for(out1, thread)["needs_cost_notice"])

        # Resume: cost_status flips off 'stopped' and the session answers
        # (fresher outbound), so the chain no longer reads cost_stopped.
        sess_resumed = {"id": "s1", "thread_id": thread, "container_status": "running",
                         "cost_status": "ok"}
        out2 = run_scan({
            "state": out1["state"], "sessions": [sess_resumed],
            "chains": {thread: {**base_chain, "our_last_outbound": "2026-06-26T11:55:00Z"}},
        })
        r2 = row_for(out2, thread)
        self.assertNotEqual(r2["state"], "cost_stopped")
        self.assertFalse(r2["needs_cost_notice"])

        # Re-stop later.
        out3 = run_scan({
            "state": out2["state"], "sessions": [sess_stopped],
            "chains": {thread: {**base_chain, "our_last_outbound": "2026-06-26T11:55:00Z"}},
        })
        r3 = row_for(out3, thread)
        self.assertEqual(r3["state"], "cost_stopped")
        self.assertTrue(r3["needs_cost_notice"], r3)  # re-armed, not suppressed by tick 1

    def test_cost_notice_fields_name_the_stopped_session(self):
        # The cost_stopped row carries ready-made deep-link fields so the
        # supervisor's factual GitHub notice can name the SPECIFIC blocked
        # session + dashboard route (#/cw/<folder>/s/<session>, session mode)
        # without re-deriving them. delta drives the dedup exactly as
        # needs_cost_notice does: the naming fields stay populated every tick
        # the row is cost_stopped, but the notice only fires on entry.
        thread = "gh-issue-shader-slang/slang-9001"
        session = _sid_at("2026-06-26T08:00:00Z")  # real sess-<ms>-<rand> id
        folder = "slang-fixer"
        payload = {
            "state": {},
            "sessions": [{"id": session, "thread_id": thread,
                          "container_status": "running", "cost_status": "stopped",
                          "group_folder": folder}],
            "chains": {thread: {
                "repo": "shader-slang/slang", "issue": 9001, "sessions": [session],
                "our_last_outbound": "2026-06-26T09:00:00Z", "comments": [],
            }},
        }
        out1 = run_scan(payload)
        r1 = row_for(out1, thread)
        self.assertEqual(r1["state"], "cost_stopped")
        self.assertNotEqual(r1["delta"], "same")          # entry tick
        self.assertTrue(r1["needs_cost_notice"], r1)       # notice fires on entry
        self.assertEqual(r1["cost_notice_session"], session)
        self.assertEqual(r1["cost_notice_folder"], folder)
        self.assertEqual(r1["cost_notice_link"], f"#/cw/{folder}/s/{session}")

        # Unchanged next tick: still cost_stopped, delta 'same' -> notice off,
        # but the naming fields remain populated on the row.
        out2 = run_scan({**payload, "state": out1["state"]})
        r2 = row_for(out2, thread)
        self.assertEqual(r2["state"], "cost_stopped")
        self.assertEqual(r2["delta"], "same")
        self.assertFalse(r2["needs_cost_notice"], r2)
        self.assertEqual(r2["cost_notice_session"], session)
        self.assertEqual(r2["cost_notice_folder"], folder)
        self.assertEqual(r2["cost_notice_link"], f"#/cw/{folder}/s/{session}")

    def test_cost_notice_fields_empty_when_not_cost_stopped(self):
        # Every row carries the keys; they are empty strings when not applicable.
        out = run_scan({
            "state": {},
            "sessions": [{"id": "s1", "thread_id": "gh-issue-o/r-cs9",
                          "container_status": "running", "group_folder": "slang-fixer"}],
            "chains": {"gh-issue-o/r-cs9": {
                "repo": "o/r", "issue": 9, "sessions": ["s1"],
                "our_last_outbound": "2026-06-26T11:55:00Z", "comments": [],
            }},
        })
        r = row_for(out, "gh-issue-o/r-cs9")
        self.assertNotEqual(r["state"], "cost_stopped")
        self.assertEqual(r["cost_notice_session"], "")
        self.assertEqual(r["cost_notice_folder"], "")
        self.assertEqual(r["cost_notice_link"], "")


class ClosedIssueArchival(unittest.TestCase):
    """We supervise OPEN issues only. A chain whose issue is CLOSED (pull-universe
    emits it as a minimal stub with issue_open:false) must be archived, never
    classified or nudged — otherwise the closed stub keeps a live board row and
    could even draw a nudge on a chain no human is waiting on."""

    def _closed_stub(self, issue=200):
        return {
            "repo": "o/r", "issue": issue, "sessions": [],
            "our_last_outbound": None, "our_last_push": None,
            "pr": None, "issue_open": False, "comments": [],
            "pending_ask_user": False,
        }

    def test_closed_chain_is_archived_not_classified(self):
        out = run_scan({
            "state": {},
            "sessions": [],
            "chains": {"gh-issue-o/r-200": self._closed_stub()},
        })
        self.assertEqual(out["rows"], [])                       # not on the board
        self.assertEqual(out["summary"]["in_flight"], 0)        # not counted live
        self.assertEqual(out["summary"]["closed"], 1)
        self.assertIn("gh-issue-o/r-200", out["state"]["_archived"])
        self.assertNotIn("gh-issue-o/r-200", out["state"])      # dropped from top level

    def test_closed_chain_is_never_nudged(self):
        # A fixer session sits on a now-closed chain: must NOT be nudged.
        out = run_scan({
            "state": {},
            "sessions": [{"id": "s1", "thread_id": "gh-issue-o/r-200",
                          "container_status": "stopped", "group_folder": "slang-fixer"}],
            "chains": {"gh-issue-o/r-200": self._closed_stub()},
        })
        self.assertEqual(out["summary"]["needs_nudge"], 0)
        self.assertEqual(out["summary"]["closed"], 1)

    def test_open_chain_alongside_closed_still_boards(self):
        out = run_scan({
            "state": {},
            "sessions": [],
            "chains": {
                "gh-issue-o/r-100": {
                    "repo": "o/r", "issue": 100, "sessions": [],
                    "our_last_outbound": None, "pr": None,
                    "issue_open": True, "comments": [],
                },
                "gh-issue-o/r-200": self._closed_stub(),
            },
        })
        self.assertEqual(len(out["rows"]), 1)
        self.assertEqual(out["rows"][0]["issue"], 100)
        self.assertEqual(out["summary"]["closed"], 1)

    def test_archival_is_idempotent(self):
        # Already in _archived from a prior tick -> not re-stamped, not double-counted.
        out = run_scan({
            "now": "2026-06-27T12:00:00Z",
            "state": {"_archived": {"gh-issue-o/r-200": {
                "issue": 200, "reason": "issue closed",
                "archivedAt": "2026-06-26T12:00:00Z"}}},
            "sessions": [],
            "chains": {"gh-issue-o/r-200": self._closed_stub()},
        })
        self.assertEqual(
            out["state"]["_archived"]["gh-issue-o/r-200"]["archivedAt"],
            "2026-06-26T12:00:00Z",  # preserved, not overwritten with the new tick
        )


class ReadOnlyRolePark(unittest.TestCase):
    """A chain held ONLY by a read-only role (slang-pr-approver) records its verdict
    in the approval ledger, never on GitHub, so ball=='ours' ('human commented last,
    unanswered by us') is a STRUCTURAL false-positive — it must NOT nudge. But a
    fixer/triager also on the chain genuinely owes a GitHub reply, so its awaiting_us
    nudge must be preserved. Measured 2026-09-11: 21 of 95 awaiting_us were
    approver-only false-positives inflating must_nudge (#12389/#12836/#12968)."""

    def _human_last_pr_chain(self, issue, folders, disp=None):
        """A chain where a human commented last on an open PR, its session(s) held
        by `folders` (list of group_folder strings). container_status='stopped' so
        the running+fresh short-circuit never applies."""
        sessions = [
            {"id": f"s{i}", "thread_id": f"gh-issue-o/r-{issue}",
             "container_status": "stopped", "group_folder": f}
            for i, f in enumerate(folders)
        ]
        chain = {
            "repo": "o/r", "issue": issue, "sessions": [s["id"] for s in sessions],
            "our_last_outbound": "2026-06-26T09:00:00Z",
            "pr": {"number": 900 + issue % 100, "state": "OPEN", "isDraft": True,
                   "fixes_issue": issue, "body_has_fixes": True},
            "comments": [{"author": "somehuman", "at": "2026-06-26T10:00:00Z", "is_bot": False}],
        }
        if disp is not None:
            chain["disposition"] = disp
        return {"sessions": sessions,
                "chains": {f"gh-issue-o/r-{issue}": chain}}

    def test_approver_only_chain_is_parked_not_nudged(self):
        out = run_scan(self._human_last_pr_chain(301, ["slang-pr-approver"]))
        r = row_for(out, "gh-issue-o/r-301")
        self.assertEqual(r["ball"], "ours")             # human still spoke last
        self.assertEqual(r["state"], "awaiting_human")  # but parked, not awaiting_us
        self.assertFalse(r["needs_nudge"])
        self.assertEqual(r["action"], "none")
        self.assertEqual(r["non_nudge_reason"], "read-only-role")
        self.assertEqual(out["summary"]["must_nudge"], 0)
        self.assertEqual(out["summary"]["awaiting_us"], 0)

    def test_slangpy_approver_only_also_parked(self):
        out = run_scan(self._human_last_pr_chain(302, ["slangpy-pr-approver"]))
        r = row_for(out, "gh-issue-o/r-302")
        self.assertFalse(r["needs_nudge"])
        self.assertEqual(r["non_nudge_reason"], "read-only-role")

    def test_approver_plus_fixer_still_nudges(self):
        # A fixer also holds the chain -> it genuinely owes a GitHub reply; the
        # awaiting_us nudge must survive (guard is read-only-ONLY).
        out = run_scan(self._human_last_pr_chain(303, ["slang-pr-approver", "slang-fixer"]))
        r = row_for(out, "gh-issue-o/r-303")
        self.assertEqual(r["state"], "awaiting_us")
        self.assertTrue(r["needs_nudge"])
        self.assertEqual(out["summary"]["must_nudge"], 1)

    def test_approver_plus_triager_still_nudges(self):
        out = run_scan(self._human_last_pr_chain(304, ["slang-pr-approver", "slang-triager"]))
        r = row_for(out, "gh-issue-o/r-304")
        self.assertEqual(r["state"], "awaiting_us")
        self.assertTrue(r["needs_nudge"])

    def test_unknown_or_empty_role_is_not_suppressed(self):
        # A session with no group_folder -> roles set is empty -> NOT read-only-only;
        # an under-populated payload can never silence a real awaiting_us chain.
        payload = self._human_last_pr_chain(305, ["slang-fixer"])
        for s in payload["sessions"]:
            s.pop("group_folder", None)
        out = run_scan(payload)
        r = row_for(out, "gh-issue-o/r-305")
        self.assertEqual(r["state"], "awaiting_us")
        self.assertTrue(r["needs_nudge"])

    def test_pure_fixer_chain_unchanged(self):
        # Regression guard: a non-approver chain classifies exactly as before.
        out = run_scan(self._human_last_pr_chain(306, ["slang-fixer"]))
        r = row_for(out, "gh-issue-o/r-306")
        self.assertEqual(r["state"], "awaiting_us")
        self.assertTrue(r["needs_nudge"])

    def test_human_owned_disposition_takes_precedence(self):
        # An approver-only chain that ALSO carries a human-owned disposition still
        # parks (as human-owned:<disp>), not read-only-role — the disposition check
        # runs first in both classify() and compute_non_nudge_reason().
        out = run_scan(self._human_last_pr_chain(307, ["slang-pr-approver"],
                                                 disp="advisory:maintainer-driving"))
        r = row_for(out, "gh-issue-o/r-307")
        self.assertFalse(r["needs_nudge"])
        self.assertTrue(r["non_nudge_reason"].startswith("human-owned:"))

    def test_approver_plus_missing_folder_session_not_suppressed(self):
        # Approver session + a genuine session whose group_folder is MISSING. The
        # guard must FAIL CLOSED — an unidentified session could be a fixer, so the
        # nudge survives (regression guard for the "missing role hides fixer" bug).
        payload = self._human_last_pr_chain(308, ["slang-pr-approver", "slang-fixer"])
        for s in payload["sessions"]:
            if s["group_folder"] == "slang-fixer":
                del s["group_folder"]
        r = row_for(run_scan(payload), "gh-issue-o/r-308")
        self.assertEqual(r["state"], "awaiting_us")
        self.assertTrue(r["needs_nudge"])

    def test_approver_plus_session_absent_from_sessions_list_not_suppressed(self):
        # chain.sessions references an id with NO row in the top-level sessions list
        # (sessions_by_id miss) -> unidentified -> must not suppress.
        payload = self._human_last_pr_chain(309, ["slang-pr-approver"])
        payload["chains"]["gh-issue-o/r-309"]["sessions"].append("ghost")
        r = row_for(run_scan(payload), "gh-issue-o/r-309")
        self.assertEqual(r["state"], "awaiting_us")
        self.assertTrue(r["needs_nudge"])

    def test_substring_lookalike_role_not_suppressed(self):
        # Exact allowlist, not substring: "slang-pr-disapprover" contains "approver"
        # but is NOT a shadow approver -> must NOT be parked.
        r = row_for(run_scan(self._human_last_pr_chain(310, ["slang-pr-disapprover"])),
                    "gh-issue-o/r-310")
        self.assertEqual(r["state"], "awaiting_us")
        self.assertTrue(r["needs_nudge"])


class NudgeCooldown(unittest.TestCase):
    """SKILL.md §3: don't re-fire the same action on a chain we already acted on when
    nothing a human is waiting on has changed since (root of the report-only drift:
    must_nudge≈122 re-flagged the same parked chains every 12h vs ~5 actually sent).
    Re-arm is driven only by EXTERNAL material events — a fresh non-bot comment, a
    coarse PR-state transition, or a cost-cap episode — each compared by its DURABLE
    observation timestamp against the marker (survives ticks the LLM skipped), NEVER
    by our own activity clock (a sent nudge must not re-arm itself). A never-acted
    chain still fires once."""

    def _awaiting_us(self, issue, prior=None, comment_at="2026-06-21T00:00:00Z",
                     our_out="2026-06-20T00:00:00Z"):
        # fixer session, human commented last, container stopped -> awaiting_us.
        chain = {
            "repo": "o/r", "issue": issue, "sessions": ["s1"],
            "our_last_outbound": our_out,
            "comments": [{"author": "human", "at": comment_at, "is_bot": False}],
        }
        state = {}
        if prior is not None:
            state[f"gh-issue-o/r-{issue}"] = prior
        return {
            "state": state,
            "sessions": [{"id": "s1", "thread_id": f"gh-issue-o/r-{issue}",
                          "container_status": "stopped", "group_folder": "slang-fixer"}],
            "chains": {f"gh-issue-o/r-{issue}": chain},
        }

    # Prior snapshot with the chain already classified awaiting_us (no state/PR change).
    _QUIET: ClassVar[dict] = {"lastState": "awaiting_us",
                              "lastActivityAt": "2026-06-20T00:00:00Z",
                              "lastPrState": None}

    def test_acted_and_quiet_is_cooled_down(self):
        # Nudged 06-22, newest human comment 06-21 (before), nothing changed -> park.
        prior = dict(self._QUIET, nudgedAt="2026-06-22T00:00:00Z")
        out = run_scan(self._awaiting_us(410, prior))
        r = row_for(out, "gh-issue-o/r-410")
        self.assertEqual(r["state"], "awaiting_us")
        self.assertFalse(r["needs_nudge"])
        self.assertEqual(r["action"], "none")
        self.assertEqual(r["non_nudge_reason"], "nudge-cooldown")
        self.assertEqual(out["summary"]["must_nudge"], 0)
        self.assertEqual(out["summary"]["nudge_cooldown"], 1)

    def test_new_inbound_comment_after_nudge_rearms(self):
        # BLOCKER 1: a maintainer comments AFTER we nudged -> re-engage, do not park.
        prior = dict(self._QUIET, nudgedAt="2026-06-22T00:00:00Z")
        out = run_scan(self._awaiting_us(411, prior, comment_at="2026-06-25T00:00:00Z"))
        r = row_for(out, "gh-issue-o/r-411")
        self.assertTrue(r["needs_nudge"])
        self.assertEqual(out["summary"]["nudge_cooldown"], 0)

    def test_own_outbound_advance_does_not_rearm(self):
        # BLOCKER 2: our_last_outbound advances PAST nudgedAt (as a sent nudge would)
        # but no new inbound and no state/PR change -> still parked. delta is
        # 'updated' (our clock moved), proving the cooldown is decoupled from delta.
        prior = dict(self._QUIET, nudgedAt="2026-06-22T00:00:00Z")
        out = run_scan(self._awaiting_us(412, prior, comment_at="2026-06-21T00:00:00Z",
                                         our_out="2026-06-25T00:00:00Z"))
        r = row_for(out, "gh-issue-o/r-412")
        self.assertEqual(r["delta"], "updated")
        self.assertFalse(r["needs_nudge"])
        self.assertEqual(r["non_nudge_reason"], "nudge-cooldown")

    def test_never_nudged_still_fires_first_nudge(self):
        out = run_scan(self._awaiting_us(413, dict(self._QUIET)))
        r = row_for(out, "gh-issue-o/r-413")
        self.assertTrue(r["needs_nudge"])
        self.assertEqual(out["summary"]["must_nudge"], 1)
        self.assertEqual(out["summary"]["nudge_cooldown"], 0)

    def test_clock_driven_state_flip_does_not_rearm(self):
        # BLOCKER 2 (indirect): `state` is derived from silent_age, so a chain flips
        # working<->silent by the passage of time alone (a sent nudge advanced our
        # clock). A prior lastState that differs ONLY through this clock-driven flip,
        # with no PR change and no new inbound, must NOT re-arm the nudge.
        sid = _sid_at("2026-06-26T06:00:00Z")   # dispatched 6h before NOW -> silent now
        payload = {
            "state": {"gh-issue-o/r-414": {"lastState": "working", "lastActivityAt": None,
                                           "lastPrState": None,
                                           "nudgedAt": "2026-06-26T05:00:00Z"}},
            "sessions": [{"id": sid, "thread_id": "gh-issue-o/r-414",
                          "container_status": "stopped", "group_folder": "slang-triager"}],
            "chains": {"gh-issue-o/r-414": {"repo": "o/r", "issue": 414,
                                            "sessions": [sid], "comments": []}},
        }
        r = row_for(run_scan(payload), "gh-issue-o/r-414")
        self.assertEqual(r["state"], "silent")        # clock moved working -> silent
        self.assertFalse(r["needs_nudge"])            # but no external change -> stay cooled
        self.assertEqual(r["non_nudge_reason"], "nudge-cooldown")

    def test_malformed_marker_not_trusted(self):
        # MINOR 5: '' / [] are NOT proof we nudged -> first nudge still fires.
        for bad in ("", []):
            prior = dict(self._QUIET, nudgedAt=bad)
            r = row_for(run_scan(self._awaiting_us(415, prior)), "gh-issue-o/r-415")
            self.assertTrue(r["needs_nudge"], f"nudgedAt={bad!r} should not cool down")

    def test_list_marker_newest_entry_cools_down(self):
        # A history LIST of timestamps is honored (newest entry is the marker).
        prior = dict(self._QUIET,
                     nudgedAt=["2026-05-01T00:00:00Z", "2026-06-22T00:00:00Z"])
        r = row_for(run_scan(self._awaiting_us(416, prior)), "gh-issue-o/r-416")
        self.assertFalse(r["needs_nudge"])
        self.assertEqual(r["non_nudge_reason"], "nudge-cooldown")

    def _pr_chain(self, issue, prior, pr_state="OPEN"):
        # awaiting_us chain WITH an open PR (human commented last, container stopped).
        return {
            "state": {f"gh-issue-o/r-{issue}": prior},
            "sessions": [{"id": "s1", "thread_id": f"gh-issue-o/r-{issue}",
                          "container_status": "stopped", "group_folder": "slang-fixer"}],
            "chains": {f"gh-issue-o/r-{issue}": {
                "repo": "o/r", "issue": issue, "sessions": ["s1"],
                "our_last_outbound": "2026-06-20T00:00:00Z",
                "pr": {"number": 900, "state": pr_state, "fixes_issue": issue},
                "comments": [{"author": "human", "at": "2026-06-21T00:00:00Z", "is_bot": False}],
            }},
        }

    def test_pr_state_change_rearms_and_is_durable(self):
        # BLOCKER (round 3): a PR-state transition must re-arm, and DURABLY — it must
        # keep re-arming on later ticks even though the raw prior.lastPrState no longer
        # differs. Tick 1: CLOSED->OPEN observed. Tick 2: OPEN==OPEN (no raw change)
        # but the recorded prStateChangedAt still post-dates the marker -> still armed.
        prior1 = {"lastState": "awaiting_us", "lastActivityAt": "2026-06-20T00:00:00Z",
                  "lastPrState": "CLOSED", "nudgedAt": "2026-06-19T00:00:00Z"}
        out1 = run_scan(self._pr_chain(430, prior1, pr_state="OPEN"))
        r1 = row_for(out1, "gh-issue-o/r-430")
        self.assertTrue(r1["needs_nudge"])                       # transition re-arms
        snap = out1["state"]["gh-issue-o/r-430"]
        self.assertEqual(snap["prStateChangedAt"], NOW)          # observation recorded
        # Tick 2: feed the produced snapshot back; PR now stable OPEN, no new comment.
        out2 = run_scan(self._pr_chain(430, snap, pr_state="OPEN"))
        r2 = row_for(out2, "gh-issue-o/r-430")
        self.assertTrue(r2["needs_nudge"], "PR re-arm must survive a skipped tick")

    def test_cost_episode_rearms_after_nudge(self):
        # A cost-cap episode recorded AFTER the marker re-arms a resumed-then-silent
        # chain (durable: costStoppedAt post-dates nudgedAt).
        prior = {"lastState": "silent", "lastActivityAt": None, "lastPrState": None,
                 "nudgedAt": "2026-06-20T00:00:00Z", "costStoppedAt": "2026-06-24T00:00:00Z"}
        r = row_for(run_scan(self._silent_escalating(431, prior)), "gh-issue-o/r-431")
        self.assertTrue(r["needs_nudge"])

    def test_cost_stopped_records_timestamp(self):
        # A chain whose session is cost-stopped -> state cost_stopped, no nudge, and
        # costStoppedAt stamped so a later resume re-arms.
        payload = {
            "state": {},
            "sessions": [{"id": "s1", "thread_id": "gh-issue-o/r-432",
                          "container_status": "running", "group_folder": "slang-fixer",
                          "cost_status": "stopped"}],
            "chains": {"gh-issue-o/r-432": {"repo": "o/r", "issue": 432,
                                            "sessions": ["s1"], "comments": []}},
        }
        out = run_scan(payload)
        r = row_for(out, "gh-issue-o/r-432")
        self.assertEqual(r["state"], "cost_stopped")
        self.assertFalse(r["needs_nudge"])
        self.assertEqual(out["state"]["gh-issue-o/r-432"]["costStoppedAt"], NOW)

    def _silent_escalating(self, issue, prior=None):
        # No comments, no PR, no activity-by-us; dispatched 6h before NOW -> silent + escalate.
        sid = _sid_at("2026-06-26T06:00:00Z")
        state = {}
        if prior is not None:
            state[f"gh-issue-o/r-{issue}"] = prior
        return {
            "state": state,
            "sessions": [{"id": sid, "thread_id": f"gh-issue-o/r-{issue}",
                          "container_status": "stopped", "group_folder": "slang-triager"}],
            "chains": {f"gh-issue-o/r-{issue}": {"repo": "o/r", "issue": issue,
                                                 "sessions": [sid], "comments": []}},
        }

    def test_already_escalated_unchanged_is_not_re_escalated(self):
        # escalatedAt recorded + delta='same' -> escalate suppressed. No nudgedAt, so
        # the needs_nudge path is untouched (isolates the escalate dedup).
        prior = {"lastState": "silent", "lastActivityAt": None, "lastPrState": None,
                 "escalatedAt": "2026-06-25T00:00:00Z"}
        out = run_scan(self._silent_escalating(420, prior))
        r = row_for(out, "gh-issue-o/r-420")
        self.assertEqual(r["state"], "silent")
        self.assertFalse(r["escalate"])               # already escalated, nothing new
        self.assertTrue(r["needs_nudge"])             # nudge path independent (no nudgedAt)
        self.assertEqual(out["summary"]["escalate"], 0)

    def test_never_escalated_silent_still_escalates(self):
        out = run_scan(self._silent_escalating(421, {"lastState": "silent",
                       "lastActivityAt": None, "lastPrState": None}))
        r = row_for(out, "gh-issue-o/r-421")
        self.assertTrue(r["escalate"])
        self.assertEqual(out["summary"]["escalate"], 1)

    def test_already_nudged_silent_still_first_escalates(self):
        # Ladder: an already-NUDGED silent chain (nudgedAt set) that has NEVER been
        # escalated (escalatedAt absent) must still fire its FIRST escalation, while
        # its nudge stays cooled. The two markers are independent.
        prior = {"lastState": "silent", "lastActivityAt": None, "lastPrState": None,
                 "nudgedAt": "2026-06-25T00:00:00Z"}
        r = row_for(run_scan(self._silent_escalating(422, prior)), "gh-issue-o/r-422")
        self.assertFalse(r["needs_nudge"])   # nudge cooled (already nudged, nothing new)
        self.assertTrue(r["escalate"])       # ...but first escalation still fires


if __name__ == "__main__":
    unittest.main(verbosity=2)
