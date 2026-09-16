#!/usr/bin/env python3
"""Tests for hermes_supervise.py, the supervise-tick core (docs/hermes-port/autopilot.md §2, §3, §5).

Each case builds a state through hermes_queue.build_state (real plan + matrix, synthetic
ledger) and a synthetic row thread, then pins one rule: a fresh row draws nothing, a stale
build nudges the builder, a nudge inside the 6 h bound is not repeated, a row past its
escalation SLO escalates only after a nudge, merged rows are ignored, holds and cost cards
never nudge. Run: python3 -m unittest ops/nemoclaw-coworkers/autopilot/test_hermes_supervise.py
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import hermes_queue as hq
import hermes_supervise as hs

DOCS = HERE.parents[2] / "docs" / "hermes-port"
PLAN = (DOCS / "dispatch-plan.md").read_text(encoding="utf-8")
MATRIX = (DOCS / "gap-matrix.md").read_text(encoding="utf-8")
NOW = "2026-09-10T12:00:00Z"
NOW_DT = datetime(2026, 9, 10, 12, 0, tzinfo=timezone.utc)
SLUG = "slang-coworkers/hermes-agent"
HEADER = (
    "| row-id | dispatched | spec accepted | PR | verdict | merged/blocked | notes |\n"
    "| --- | --- | --- | --- | --- | --- | --- |\n"
)


def ago(hours: float) -> str:
    return (NOW_DT - timedelta(hours=hours)).isoformat().replace("+00:00", "Z")


def parse_ts(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def stamp(hours: float) -> str:
    """Ledger-cell stamp `YYYY-MM-DD HH:MMZ` for a moment `hours` before NOW."""
    return (NOW_DT - timedelta(hours=hours)).strftime("%Y-%m-%d %H:%MZ")


def ledger(rows: list[dict]) -> str:
    out = HEADER
    for r in rows:
        out += (
            f"| {r['id']} | {r.get('dispatched', stamp(24) + ' (to hermes-architect)')} | {r.get('spec', '—')} "
            f"| {r.get('pr', '—')} | {r.get('verdict', '—')} | {r.get('outcome', '—')} | n |\n"
        )
    return out


def merged_row(rid: str, pr: int) -> dict:
    return {"id": rid, "spec": stamp(20), "pr": f"#{pr}", "verdict": "round 1/2 = PASS; APPROVE", "outcome": f"MERGED `abcdef1` /pull/{pr}"}


def state(rows: list[dict], config: dict | None = None) -> dict:
    return hq.build_state(PLAN, MATRIX, ledger(rows), config=config, now=NOW)


def msg(hours: float, text: str, direction: str = "out", **extra) -> dict:
    return {"ts": ago(hours), "direction": direction, "text": text, **extra}


def spec_handoff(rid: str, hours: float, core_change: str = "none") -> dict:
    return msg(hours, f"[Spec handoff] {rid}: title\n- **Classification:** PORT-as-plugin\n- **CORE-CHANGE:** {core_change}\n- **Routing:** forwarding to hermes-builder", sender="hermes-architect")


def builder_start(rid: str, hours: float) -> dict:
    return msg(hours, f"Spec handoff {rid}: title\nPriority: P0", sender="hermes-architect")


def handoff(pr: int, head: str, hours: float, round_no: int = 1) -> dict:
    if round_no == 1:
        return msg(hours, f"Fix report — {SLUG}#{pr}: title\n- **PR:** url (draft, fork only; head {head})", sender="hermes-builder")
    return msg(hours, f"[Fix Report] {SLUG}#{pr} (test round {round_no}, head {head}): fixed rows", sender="hermes-builder")


def test_report(pr: int, head: str, round_no: int, verdict: str, hours: float, extra: str = "") -> dict:
    return msg(hours, f"[Test Report] {SLUG}#{pr} (round {round_no}/2, head {head[:7]})\n- **Verdict:** {verdict}\n{extra}", sender="hermes-tester")


def review_verdict(pr: int, head: str, round_no: int, verdict: str, hours: float) -> dict:
    return msg(hours, f"[Review Verdict] {SLUG}#{pr} (round {round_no}, head {head[:7]})\n\n- **Verdict:** {verdict}", sender="hermes-reviewer")


def triage(rid: str, hours: float, outcome: str = "fixed", gate: bool = True) -> dict:
    block = "\n\n## Merge gate\n- **PR:** x" if gate else ""
    return msg(hours, f"[Triage Resolution] {rid}: title\n\n- **Outcome:** {outcome}{block}", sender="hermes-architect")


def pr(number: int, rid: str, head: str, state_: str = "OPEN", created_h: float = 6, updated_h: float | None = None) -> dict:
    return {
        "number": number, "title": f"feat(compose): render profiles [{rid}]", "state": state_, "isDraft": state_ == "OPEN",
        "createdAt": ago(created_h), "updatedAt": ago(updated_h if updated_h is not None else created_h),
        "headRefName": "feat/x", "body": "", "headRefOid": head,
    }


HEAD_A = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678"
HEAD_B = "b2c3d4e5f60718293a4b5c6d7e8f9012345678a1"


def run(st: dict, threads: dict, prs: list | None = None, nudges: dict | None = None, sessions: dict | None = None, config: dict | None = None, acks: dict | None = None) -> dict:
    # These threads predate hermes-task-card (no "card · " captions); the card_missing check is exercised in test_card_missing.py.
    return hs.supervise(st, threads, prs or [], nudges or {}, NOW, sessions=sessions, config={"card_check": False, **(config or {})}, acks=acks)


class FreshAndStale(unittest.TestCase):
    def test_fresh_dispatched_row_no_action(self):
        st = state([{"id": "LOOP-F35", "dispatched": stamp(1) + " (to hermes-architect)"}])
        out = run(st, {"hermes-LOOP-F35": [msg(1, "Dispatch LOOP-F35: Lego coworker composition.", "in")]})
        r = out["rows"]["LOOP-F35"]
        self.assertEqual(r["stage"], "dispatched")
        self.assertEqual(r["age_hours"], 1.0)
        self.assertEqual(r["clock_start"], ago(1))
        self.assertFalse(r["slo_breach"])
        self.assertEqual((r["action"], r["target_role"]), ("none", "hermes-architect"))
        self.assertEqual(out["summary"]["must_nudge"], 0)
        self.assertEqual(out["actions"], [])

    def test_stale_build_nudges_builder(self):
        st = state([{"id": "LOOP-F35", "spec": stamp(11)}])
        out = run(st, {"hermes-LOOP-F35": [spec_handoff("LOOP-F35", 11), builder_start("LOOP-F35", 10)]})
        r = out["rows"]["LOOP-F35"]
        self.assertEqual(r["stage"], "building")
        self.assertEqual(r["clock_start"], ago(10))
        self.assertEqual(r["age_hours"], 10.0)
        self.assertTrue(r["slo_breach"])
        self.assertFalse(r["escalation_due"])
        self.assertEqual((r["action"], r["target_role"]), ("nudge", "hermes-builder"))
        self.assertTrue(r["message"].startswith("Supervisor nudge LOOP-F35: building for 10h, no draft PR."))
        self.assertIn("titled [LOOP-F35]", r["message"])
        self.assertIn("on thread hermes-LOOP-F35", r["message"])
        self.assertNotEqual(r["message"][0], "[")  # unmarked: the chain-routing gate denies a marked fresh send
        self.assertEqual(out["summary"]["must_nudge"], 1)
        self.assertEqual(out["actions"][0]["kind"], "nudge")
        self.assertEqual(out["actions"][0]["thread_id"], "hermes-LOOP-F35")

    def test_spec_handoff_stage_nudges_architect_after_2h(self):
        st = state([{"id": "LOOP-F35", "spec": stamp(3)}])
        out = run(st, {"hermes-LOOP-F35": [spec_handoff("LOOP-F35", 3)]})
        r = out["rows"]["LOOP-F35"]
        self.assertEqual(r["stage"], "spec_handoff")
        self.assertEqual((r["action"], r["target_role"]), ("nudge", "hermes-architect"))
        self.assertIn("no forward to hermes-builder", r["message"])

    def test_ledger_spec_accepted_counts_without_thread(self):
        st = state([{"id": "LOOP-F35", "spec": stamp(1)}])
        r = run(st, {})["rows"]["LOOP-F35"]
        self.assertEqual(r["stage"], "spec_handoff")
        self.assertEqual(r["action"], "none")


class NudgeBound(unittest.TestCase):
    def setUp(self):
        self.st = state([{"id": "LOOP-F35", "spec": stamp(11)}])
        self.threads = {"hermes-LOOP-F35": [spec_handoff("LOOP-F35", 11), builder_start("LOOP-F35", 10)]}

    def test_recent_nudge_not_repeated(self):
        out = run(self.st, self.threads, nudges={"LOOP-F35": ago(2)})
        r = out["rows"]["LOOP-F35"]
        self.assertTrue(r["slo_breach"])
        self.assertEqual(r["action"], "none")
        self.assertEqual(r["slo_status"], "nudged")
        self.assertIn("nudge bound", r["reason"])
        self.assertEqual(out["summary"]["must_nudge"], 0)

    def test_nudge_repeats_after_6h(self):
        out = run(self.st, self.threads, nudges={"LOOP-F35": {"last_nudge": ago(6.5), "state": "building", "count": 1}})
        self.assertEqual(out["rows"]["LOOP-F35"]["action"], "nudge")

    def test_nudge_seen_on_thread_counts(self):
        threads = {"hermes-LOOP-F35": self.threads["hermes-LOOP-F35"] + [msg(1, "Supervisor nudge LOOP-F35: building for 9h, no draft PR.", sender="orchestrator")]}
        r = run(self.st, threads)["rows"]["LOOP-F35"]
        self.assertEqual(r["action"], "none")
        self.assertEqual(r["nudges"]["count"], 1)
        self.assertEqual(r["nudges"]["last"], ago(1))

    def test_state_change_does_not_reset_bound(self):
        # nudged 3 h ago while `spec_handoff`; now `building` for 9 h: still inside the 6 h bound.
        threads = {"hermes-LOOP-F35": [spec_handoff("LOOP-F35", 14), builder_start("LOOP-F35", 9)]}
        r = run(self.st, threads, nudges={"LOOP-F35": {"last_nudge": ago(3), "state": "spec_handoff"}})["rows"]["LOOP-F35"]
        self.assertEqual(r["stage"], "building")
        self.assertEqual(r["action"], "none")
        self.assertFalse(r["nudges"]["in_state"])


class Escalation(unittest.TestCase):
    def setUp(self):
        self.st = state([{"id": "LOOP-F35", "spec": stamp(18)}])
        self.threads = {"hermes-LOOP-F35": [spec_handoff("LOOP-F35", 18), builder_start("LOOP-F35", 17)]}

    def test_past_slo_with_prior_nudge_escalates(self):
        out = run(self.st, self.threads, nudges={"LOOP-F35": {"last_nudge": ago(8), "state": "building", "count": 1}})
        r = out["rows"]["LOOP-F35"]
        self.assertTrue(r["escalation_due"])
        self.assertEqual(r["action"], "escalate")
        self.assertEqual(r["alert_kind"], "slo")
        self.assertTrue(r["alert_line"].startswith(f"- {NOW} · LOOP-F35 · building 17h · no draft PR for 17h (SLO 16h) · nudged 1× (last {ago(8)}) · decision: "), r["alert_line"])
        self.assertTrue(r["alert_line"].endswith("· PR #- · thread hermes-LOOP-F35"))
        self.assertTrue(r["status_line"].startswith("Autopilot alert LOOP-F35 · building 17h"))
        self.assertEqual(out["summary"]["escalate"], 1)
        self.assertEqual(out["summary"]["must_nudge"], 0)
        alert = next(a for a in out["actions"] if a["kind"] == "alert")
        self.assertEqual(alert["thread_id"], "hermes-status")
        self.assertEqual(alert["alert_key"], "slo:building")

    def test_escalation_requires_a_nudge_first(self):
        r = run(self.st, self.threads)["rows"]["LOOP-F35"]
        self.assertTrue(r["escalation_due"])
        self.assertEqual(r["action"], "nudge")  # nudge now, escalate on a later tick

    def test_alert_not_repeated_within_24h(self):
        book = {"LOOP-F35": {"last_nudge": ago(8), "state": "building", "count": 1, "alerts": {"slo:building": ago(3)}}}
        out = run(self.st, self.threads, nudges=book)
        r = out["rows"]["LOOP-F35"]
        self.assertEqual(r["action"], "none")
        self.assertEqual(r["slo_status"], "escalated")
        self.assertEqual(out["alerts"], [])

    def test_alert_rearms_after_24h(self):
        book = {"LOOP-F35": {"last_nudge": ago(8), "state": "building", "count": 1, "alerts": {"slo:building": ago(25)}}}
        self.assertEqual(run(self.st, self.threads, nudges=book)["rows"]["LOOP-F35"]["action"], "escalate")


class Terminal(unittest.TestCase):
    def test_merged_ledger_row_is_not_supervised(self):
        st = state([merged_row("LOOP-F35", 2)])
        out = run(st, {"hermes-LOOP-F35": [builder_start("LOOP-F35", 40)]})
        self.assertNotIn("LOOP-F35", out["rows"])
        self.assertEqual(out["actions"], [])

    def test_fork_merged_overrides_stale_ledger(self):
        st = state([{"id": "LOOP-F35", "spec": stamp(30), "pr": "#2"}])
        threads = {"hermes-LOOP-F35": [builder_start("LOOP-F35", 30), handoff(2, HEAD_A, 20)]}
        out = run(st, threads, prs=[pr(2, "LOOP-F35", HEAD_A, "MERGED")])
        r = out["rows"]["LOOP-F35"]
        self.assertEqual((r["stage"], r["action"]), ("merged", "none"))
        self.assertEqual(out["summary"]["in_flight"], 0)

    def test_other_rows_merge_notice_fanned_in_is_not_this_rows_merge(self):
        """The dashboard 'Merged …#25 … [ISO-F15]' line reaches every hermes-<ROW> thread as an "in"
        copy; CRED-F28 must stay at its real stage, and an outbound notice naming another row is noise."""
        st = state([{"id": "CRED-F28", "spec": stamp(30), "pr": "-"}])
        threads = {"hermes-CRED-F28": [
            builder_start("CRED-F28", 30),
            msg(2, f"Merged {SLUG}#25 feat(plugins): enforce fleet session-driver seam [ISO-F15] — squash 1bb3b8a", direction="in"),
            msg(1.5, f"Merged {SLUG}#22 feat(plugins): render declared cron jobs [SCHED-F33] — squash f8d79a1"),
        ]}
        out = run(st, threads)
        r = out["rows"]["CRED-F28"]
        self.assertNotEqual(r["stage"], "merged")
        self.assertEqual(out["summary"]["in_flight"], 1)
        # the row's OWN notice, written on its thread, still counts
        threads["hermes-CRED-F28"].append(msg(1, f"Merged {SLUG}#27 feat(plugins): podman-onecli credential half [CRED-F28] — squash 0d97eee"))
        out2 = run(st, threads)
        self.assertEqual(out2["rows"]["CRED-F28"]["stage"], "merged")

    def test_blocked_row_escalates_once_never_nudges(self):
        st = state([merged_row("LOOP-F35", 2), {"id": "MEM-F44", "outcome": "blocked: STOP cap - test FAIL x2"}])
        out = run(st, {})
        r = out["rows"]["MEM-F44"]
        self.assertEqual((r["stage"], r["action"], r["alert_kind"]), ("blocked", "escalate", "blocked"))
        self.assertIn("cap - test FAIL x2", r["alert_line"])
        again = run(st, {}, nudges={"MEM-F44": {"alerts": {"blocked:blocked": ago(1)}}})
        self.assertEqual(again["rows"]["MEM-F44"]["action"], "none")
        self.assertEqual(again["summary"]["must_nudge"], 0)

    def test_unreadable_thread_degrades_to_no_action(self):
        st = state([{"id": "LOOP-F35", "spec": stamp(30)}])
        out = run(st, {"hermes-LOOP-F35": None})
        r = out["rows"]["LOOP-F35"]
        self.assertFalse(r["thread_ok"])
        self.assertEqual((r["action"], r["slo_status"]), ("none", "unknown"))
        self.assertEqual(out["summary"]["must_nudge"], 0)

    def test_closed_pr_is_blocked(self):
        st = state([{"id": "LOOP-F35", "spec": stamp(30), "pr": "#2"}])
        r = run(st, {}, prs=[pr(2, "LOOP-F35", HEAD_A, "CLOSED")])["rows"]["LOOP-F35"]
        self.assertEqual(r["stage"], "blocked")
        self.assertIn("closed unmerged", r["reason"])


class StageWalk(unittest.TestCase):
    """§2.3: terminal first, then the first stage whose evidence exists, walking backwards."""

    def setUp(self):
        self.st = state([{"id": "LOOP-F35", "spec": stamp(30), "pr": "#2 (draft)"}])
        self.base = [spec_handoff("LOOP-F35", 30), builder_start("LOOP-F35", 29)]

    def test_pr_open_unhanded(self):
        r = run(self.st, {"hermes-LOOP-F35": self.base}, prs=[pr(2, "LOOP-F35", HEAD_A, created_h=3)])["rows"]["LOOP-F35"]
        self.assertEqual((r["stage"], r["target_role"], r["action"]), ("pr_open", "hermes-builder", "nudge"))
        self.assertEqual(r["clock_start"], ago(3))
        self.assertEqual(r["head"], HEAD_A[:7])
        self.assertIn("round-1 hand-off to hermes-tester for PR #2 head a1b2c3d", r["message"])

    def test_handoff_is_testing_round_1(self):
        threads = {"hermes-LOOP-F35": self.base + [handoff(2, HEAD_A, 7)]}
        r = run(self.st, threads, prs=[pr(2, "LOOP-F35", HEAD_A, created_h=8)])["rows"]["LOOP-F35"]
        self.assertEqual((r["stage"], r["stage_label"], r["target_role"]), ("testing", "testing(1)", "hermes-tester"))
        self.assertEqual(r["clock_start"], ago(7))
        self.assertEqual(r["action"], "nudge")
        self.assertIn("test-report-a1b2c3d.md", r["message"])

    def test_pass_is_review_then_approve_is_gate(self):
        threads = {"hermes-LOOP-F35": self.base + [handoff(2, HEAD_A, 9), test_report(2, HEAD_A, 1, "PASS", 5)]}
        r = run(self.st, threads, prs=[pr(2, "LOOP-F35", HEAD_A, created_h=10)])["rows"]["LOOP-F35"]
        self.assertEqual((r["stage"], r["target_role"], r["clock_start"]), ("review", "hermes-reviewer", ago(5)))
        self.assertEqual(r["action"], "nudge")
        threads["hermes-LOOP-F35"].append(review_verdict(2, HEAD_A, 1, "APPROVE", 1))
        out = run(self.st, threads, prs=[pr(2, "LOOP-F35", HEAD_A, created_h=10)])
        r = out["rows"]["LOOP-F35"]
        self.assertEqual((r["stage"], r["target_role"], r["action"]), ("gate", "hermes-architect", "none"))
        self.assertIn("[Triage Resolution]", hs.expected_artifact("gate", {"pr": 2, "head": HEAD_A}, "LOOP-F35", {})[1])
        self.assertEqual([a["kind"] for a in out["actions"]], [])  # no Triage Resolution yet: no gate action

    def test_triage_resolution_targets_orchestrator_and_emits_gate_action(self):
        threads = {"hermes-LOOP-F35": self.base + [handoff(2, HEAD_A, 9), test_report(2, HEAD_A, 1, "PASS", 6), review_verdict(2, HEAD_A, 1, "APPROVE", 5), triage("LOOP-F35", 4.5)]}
        out = run(self.st, threads, prs=[pr(2, "LOOP-F35", HEAD_A, created_h=10)])
        r = out["rows"]["LOOP-F35"]
        self.assertEqual((r["stage"], r["target_role"]), ("gate", "orchestrator"))
        self.assertTrue(r["triage_present"])
        gate = [a for a in out["actions"] if a["kind"] == "gate"]
        self.assertEqual(len(gate), 1)
        self.assertEqual(gate[0]["pr"], 2)
        self.assertEqual(r["action"], "nudge")  # 5 h in gate > 4 h SLO
        self.assertIn("merge gate", r["message"])

    def test_fail_then_new_head_walks_correctly(self):
        threads = {"hermes-LOOP-F35": self.base + [handoff(2, HEAD_A, 12), test_report(2, HEAD_A, 1, "FAIL", 9)]}
        r = run(self.st, threads, prs=[pr(2, "LOOP-F35", HEAD_A, created_h=13)])["rows"]["LOOP-F35"]
        self.assertEqual((r["stage"], r["target_role"], r["clock_start"]), ("building", "hermes-builder", ago(9)))
        self.assertEqual(r["fail_count"], 1)
        self.assertTrue(r["slo_breach"])
        self.assertIn("new head on PR #2", r["message"])
        self.assertIn("round 2/2", r["message"])
        # builder pushed head B 2 h ago, no hand-off yet -> pr_open on the push clock
        r = run(self.st, threads, prs=[pr(2, "LOOP-F35", HEAD_B, created_h=13, updated_h=2)])["rows"]["LOOP-F35"]
        self.assertEqual((r["stage"], r["clock_start"], r["round"]), ("pr_open", ago(2), 2))
        # hand-off for head B -> testing(2)
        threads["hermes-LOOP-F35"].append(handoff(2, HEAD_B, 1, round_no=2))
        r = run(self.st, threads, prs=[pr(2, "LOOP-F35", HEAD_B, created_h=13, updated_h=2)])["rows"]["LOOP-F35"]
        self.assertEqual((r["stage"], r["stage_label"], r["action"]), ("testing", "testing(2)", "none"))

    def test_fail_twice_blocks_unless_round_authorized(self):
        threads = {"hermes-LOOP-F35": self.base + [
            handoff(2, HEAD_A, 20), test_report(2, HEAD_A, 1, "FAIL", 18),
            handoff(2, HEAD_B, 10, round_no=2), test_report(2, HEAD_B, 2, "FAIL ×2 — ESCALATE", 3),
        ]}
        out = run(self.st, threads, prs=[pr(2, "LOOP-F35", HEAD_B, created_h=21)])
        r = out["rows"]["LOOP-F35"]
        self.assertEqual((r["stage"], r["action"], r["alert_kind"]), ("blocked", "escalate", "blocked"))
        self.assertIn("cap: test FAIL x2", r["reason"])
        out = run(self.st, threads, prs=[pr(2, "LOOP-F35", HEAD_B, created_h=21)], config={"authorize_round": {"LOOP-F35": "environmental"}})
        self.assertEqual(out["rows"]["LOOP-F35"]["stage"], "building")

    def test_request_changes_twice_blocks(self):
        threads = {"hermes-LOOP-F35": self.base + [
            handoff(2, HEAD_A, 20), test_report(2, HEAD_A, 1, "PASS", 18), review_verdict(2, HEAD_A, 1, "REQUEST_CHANGES", 16),
            handoff(2, HEAD_B, 10, round_no=2), test_report(2, HEAD_B, 2, "PASS", 8), review_verdict(2, HEAD_B, 2, "REQUEST_CHANGES", 3),
        ]}
        r = run(self.st, threads, prs=[pr(2, "LOOP-F35", HEAD_B, created_h=21)])["rows"]["LOOP-F35"]
        self.assertEqual(r["stage"], "blocked")
        self.assertEqual(r["rc_count"], 2)

    def test_escalate_report_is_environmental_not_a_round(self):
        threads = {"hermes-LOOP-F35": self.base + [handoff(2, HEAD_A, 9), test_report(2, HEAD_A, 1, "ESCALATE", 5, "- **Blocker:** DESKTOP=SKIPPED — install_packages: apt=[xvfb]")]}
        out = run(self.st, threads, prs=[pr(2, "LOOP-F35", HEAD_A, created_h=10)])
        r = out["rows"]["LOOP-F35"]
        self.assertEqual((r["stage"], r["env_fail"], r["fail_count"]), ("testing", True, 0))
        self.assertEqual((r["action"], r["alert_kind"]), ("escalate", "env-fail"))
        self.assertIn("apt=[xvfb]", r["alert_line"])
        self.assertIn("authorize one extra test round", r["alert_line"])

    def test_pr_matched_by_branch_when_title_lacks_tag(self):
        p = pr(2, "OTHER", HEAD_A, created_h=3)
        p["headRefName"] = "plugin/loop-f35"
        r = run(self.st, {"hermes-LOOP-F35": self.base}, prs=[p])["rows"]["LOOP-F35"]
        self.assertEqual((r["stage"], r["pr"]), ("pr_open", 2))


class CrossSessionCopies(unittest.TestCase):
    """pull-state.sh flattens every role's session onto one thread, so one send appears as the
    sender's `out` and the receiver's `in`. Copies must never count as two rounds."""

    def setUp(self):
        self.st = state([{"id": "LOOP-F35", "spec": stamp(30), "pr": "#2 (draft)"}])
        self.base = [spec_handoff("LOOP-F35", 30), builder_start("LOOP-F35", 29), msg(29, "Spec handoff LOOP-F35: title\nPriority: P0", "in", sender="hermes-architect", role="hermes-builder")]
        self.prs = [pr(2, "LOOP-F35", HEAD_A, created_h=21)]

    def copies(self, m: dict, role_in: str) -> list[dict]:
        seconds_later = (parse_ts(m["ts"]) + timedelta(seconds=2)).isoformat().replace("+00:00", "Z")
        return [m, {**m, "ts": seconds_later, "direction": "in", "role": role_in}]

    def test_one_fail_seen_from_both_sessions_is_one_round(self):
        threads = {"hermes-LOOP-F35": self.base
                   + self.copies(handoff(2, HEAD_A, 20), "hermes-tester")
                   + self.copies(test_report(2, HEAD_A, 1, "FAIL", 18), "hermes-builder")}
        r = run(self.st, threads, prs=self.prs)["rows"]["LOOP-F35"]
        self.assertEqual((r["stage"], r["fail_count"], len(r["test_rounds"])), ("building", 1, 1))
        self.assertEqual(r["target_role"], "hermes-builder")

    def test_one_request_changes_seen_twice_is_one_round(self):
        threads = {"hermes-LOOP-F35": self.base + [handoff(2, HEAD_A, 20), test_report(2, HEAD_A, 1, "PASS", 18)]
                   + self.copies(review_verdict(2, HEAD_A, 1, "REQUEST_CHANGES", 16), "hermes-builder")}
        r = run(self.st, threads, prs=self.prs)["rows"]["LOOP-F35"]
        self.assertEqual((r["stage"], r["rc_count"]), ("building", 1))

    def test_identical_nudges_six_hours_apart_stay_distinct(self):
        # No PR yet: building for 9 h (nudge after 8 h, escalate after 16 h). Two identical nudge
        # lines 12 h apart are two events; the newest one (1 h ago) is the bound, so no third nudge.
        st = state([{"id": "LOOP-F35", "spec": stamp(30)}])
        text = "Supervisor nudge LOOP-F35: building for 9h, no draft PR."
        threads = {"hermes-LOOP-F35": [spec_handoff("LOOP-F35", 30), builder_start("LOOP-F35", 9),
                                       msg(13, text, sender="orchestrator"), msg(1, text, sender="orchestrator")]}
        r = run(st, threads)["rows"]["LOOP-F35"]
        self.assertEqual((r["stage"], r["age_hours"]), ("building", 9.0))
        self.assertEqual(r["nudges"]["count"], 2)
        self.assertEqual(r["nudges"]["last"], ago(1))
        self.assertEqual((r["action"], r["slo_status"]), ("none", "nudged"))

    def test_report_for_another_pr_is_ignored_once_the_rows_pr_is_known(self):
        # An orchestrator session attributed by mention relays P0-LOOP's round-3 FAIL on PR #1.
        threads = {"hermes-LOOP-F35": self.base + [handoff(2, HEAD_A, 20), test_report(2, HEAD_A, 1, "FAIL", 18),
                                                   test_report(1, "888ce153872095445cdc7767309d8ee92ca6d371", 3, "FAIL", 17)]}
        r = run(self.st, threads, prs=self.prs)["rows"]["LOOP-F35"]
        self.assertEqual((r["stage"], r["fail_count"]), ("building", 1))
        self.assertEqual([t["round"] for t in r["test_rounds"]], [1])

    def test_authorized_round_lifts_cap_by_exactly_one(self):
        threads = {"hermes-LOOP-F35": self.base + [
            handoff(2, HEAD_A, 20), test_report(2, HEAD_A, 1, "FAIL", 18),
            handoff(2, HEAD_B, 10, round_no=2), test_report(2, HEAD_B, 2, "FAIL", 8),
        ]}
        cfg = {"authorize_round": {"LOOP-F35": "environmental"}}
        r = run(self.st, threads, prs=[pr(2, "LOOP-F35", HEAD_B, created_h=21)], config=cfg)["rows"]["LOOP-F35"]
        self.assertEqual(r["stage"], "building")
        threads["hermes-LOOP-F35"] += [handoff(2, HEAD_B, 6, round_no=2), test_report(2, HEAD_B, 3, "FAIL", 3)]
        r = run(self.st, threads, prs=[pr(2, "LOOP-F35", HEAD_B, created_h=21)], config=cfg)["rows"]["LOOP-F35"]
        self.assertEqual(r["stage"], "blocked")
        self.assertIn("round 3 used", r["reason"])


class HoldsAndCost(unittest.TestCase):
    def test_batch5_fleet_row_at_gate_holds_on_batches_3_and_4_like_the_p6_adopt_row(self):
        """FLEET-F62 (batch 5, BUILD) at `gate` while batch 3 is unmerged: `hold: batch3+4`, exactly the hold the ISO-F17
        adopt row (attaches to P6-fleet) gets; once batch 3 merges too the hold lifts."""
        batch2 = ("LOOP-F37", "GOV-F24", "GOV-F25", "COST-F29", "COST-F30", "LOOP-F40")
        batch3 = ("CRED-F28", "ISO-F13", "ISO-F14", "ISO-F15")
        merged = [merged_row("LOOP-F35", 2)] + [merged_row(r, i + 10) for i, r in enumerate(batch2)] + [merged_row("A2A-F21", 30)]
        st = state(merged + [{"id": "FLEET-F62", "spec": stamp(28), "pr": "#40"}, {"id": "ISO-F17", "spec": stamp(28), "pr": "#41"}])
        self.assertEqual((st["gating"]["batch3_merged"], st["gating"]["batch4_merged"]), (False, True))
        self.assertEqual((st["rows"]["FLEET-F62"]["batch"], st["rows"]["ISO-F17"]["batch"]), ("5", "adopt"))

        def chain(rid: str, n: int) -> list[dict]:
            return [spec_handoff(rid, 28), builder_start(rid, 27), handoff(n, HEAD_A, 20), test_report(n, HEAD_A, 1, "PASS", 15),
                    review_verdict(n, HEAD_A, 1, "APPROVE", 10), triage(rid, 9)]

        threads = {"hermes-FLEET-F62": chain("FLEET-F62", 40), "hermes-ISO-F17": chain("ISO-F17", 41)}
        out = run(st, threads, prs=[pr(40, "FLEET-F62", HEAD_A, created_h=21), pr(41, "ISO-F17", HEAD_A, created_h=21)])
        for rid in ("FLEET-F62", "ISO-F17"):
            r = out["rows"][rid]
            self.assertEqual((r["stage"], r["hold"], r["action"]), ("gate", "batch3+4", "none"), rid)
            self.assertFalse(r["slo_breach"], rid)
            self.assertEqual([a["kind"] for a in out["actions"] if a["row"] == rid], ["hold"], rid)
        self.assertEqual(out["summary"]["hold"], 2)
        # batch 3 merged as well: no hold, the gate action asks for the merge-gate run
        st2 = state(merged + [merged_row(r, i + 20) for i, r in enumerate(batch3)] + [{"id": "FLEET-F62", "spec": stamp(28), "pr": "#40"}])
        self.assertTrue(st2["gating"]["batch3_merged"] and st2["gating"]["batch4_merged"])
        out2 = run(st2, {"hermes-FLEET-F62": chain("FLEET-F62", 40)}, prs=[pr(40, "FLEET-F62", HEAD_A, created_h=21)])
        r = out2["rows"]["FLEET-F62"]
        self.assertEqual((r["stage"], r["hold"]), ("gate", None))
        kinds = [a["kind"] for a in out2["actions"] if a["row"] == "FLEET-F62"]
        self.assertIn("gate", kinds)
        self.assertNotIn("hold", kinds)  # the SLO clock runs again (a nudge may ride along); no hold

    def test_1b_row_at_gate_holds_while_1a_unmerged(self):
        st = state([{"id": "LOOP-F35", "spec": stamp(30), "pr": "#2", "verdict": "round 1/2 = PASS"}, {"id": "MEM-F44", "spec": stamp(28), "pr": "#3"}])
        threads = {"hermes-MEM-F44": [spec_handoff("MEM-F44", 28), builder_start("MEM-F44", 27), handoff(3, HEAD_A, 20), test_report(3, HEAD_A, 1, "PASS", 15), review_verdict(3, HEAD_A, 1, "APPROVE", 10), triage("MEM-F44", 9)]}
        out = run(st, threads, prs=[pr(3, "MEM-F44", HEAD_A, created_h=21)])
        r = out["rows"]["MEM-F44"]
        self.assertEqual((r["stage"], r["hold"], r["action"]), ("gate", "1a", "none"))
        self.assertFalse(r["slo_breach"])
        self.assertEqual([a["kind"] for a in out["actions"] if a["row"] == "MEM-F44"], ["hold"])
        self.assertEqual(out["summary"]["hold"], 1)
        # LOOP-F35 itself: ledger PR #2 with no fork row and no thread -> degraded pr_open, still nudged
        self.assertEqual(out["rows"]["LOOP-F35"]["stage"], "pr_open")
        self.assertIn("degraded", out["rows"]["LOOP-F35"]["reason"])

    def test_hold_too_long_alerts_after_48h(self):
        st = state([{"id": "LOOP-F35", "spec": stamp(80), "pr": "#2", "verdict": "round 1/2 = PASS"}, {"id": "MEM-F44", "spec": stamp(78), "pr": "#3"}])
        threads = {"hermes-MEM-F44": [builder_start("MEM-F44", 77), handoff(3, HEAD_A, 70), test_report(3, HEAD_A, 1, "PASS", 65), review_verdict(3, HEAD_A, 1, "APPROVE", 50)]}
        r = run(st, threads, prs=[pr(3, "MEM-F44", HEAD_A, created_h=71)])["rows"]["MEM-F44"]
        self.assertEqual((r["hold"], r["action"], r["alert_kind"]), ("1a", "escalate", "hold-too-long"))

    def test_gate_not_held_once_1a_merged(self):
        st = state([merged_row("LOOP-F35", 2), {"id": "MEM-F44", "spec": stamp(28), "pr": "#3"}])
        threads = {"hermes-MEM-F44": [builder_start("MEM-F44", 27), handoff(3, HEAD_A, 20), test_report(3, HEAD_A, 1, "PASS", 15), review_verdict(3, HEAD_A, 1, "APPROVE", 1)]}
        r = run(st, threads, prs=[pr(3, "MEM-F44", HEAD_A, created_h=21)])["rows"]["MEM-F44"]
        self.assertEqual((r["stage"], r["hold"]), ("gate", None))

    def test_core_change_holds_gate_until_ok_listed(self):
        st = state([{"id": "LOOP-F35", "spec": stamp(30), "pr": "#2"}])
        threads = {"hermes-LOOP-F35": [spec_handoff("LOOP-F35", 30, "hermes_cli/plugins.py:12 — needs a hook"), builder_start("LOOP-F35", 29), handoff(2, HEAD_A, 20), test_report(2, HEAD_A, 1, "PASS", 15), review_verdict(2, HEAD_A, 1, "APPROVE", 1)]}
        r = run(st, threads, prs=[pr(2, "LOOP-F35", HEAD_A, created_h=21)])["rows"]["LOOP-F35"]
        self.assertEqual((r["stage"], r["hold"], r["core_change"]), ("gate", "core-change", True))
        r = run(st, threads, prs=[pr(2, "LOOP-F35", HEAD_A, created_h=21)], config={"core_change_ok": ["LOOP-F35"]})["rows"]["LOOP-F35"]
        self.assertIsNone(r["hold"])

    def test_paused_row_holds_and_never_nudges(self):
        st = state([{"id": "LOOP-F35", "spec": stamp(30)}], config={"paused_rows": ["LOOP-F35"]})
        r = run(st, {"hermes-LOOP-F35": [builder_start("LOOP-F35", 29)]}, config={"paused_rows": ["LOOP-F35"]})["rows"]["LOOP-F35"]
        self.assertEqual((r["stage"], r["hold"], r["action"]), ("building", "paused", "none"))

    def test_cost_hold_escalates_card_and_never_nudges(self):
        st = state([{"id": "LOOP-F35", "spec": stamp(30)}])
        threads = {"hermes-LOOP-F35": [builder_start("LOOP-F35", 29)]}
        sessions = {"hermes-LOOP-F35": [{"role": "hermes-builder", "session_id": "sess-1", "cost_status": "stopped", "container_status": "stopped"}]}
        out = run(st, threads, sessions=sessions)
        r = out["rows"]["LOOP-F35"]
        self.assertTrue(r["cost_hold"])
        self.assertEqual((r["action"], r["alert_kind"]), ("escalate", "cost-card"))
        self.assertIn("sess-1", r["alert_line"])
        self.assertIn("Continue or Stop", r["alert_line"])
        self.assertEqual(out["summary"]["must_nudge"], 0)
        again = run(st, threads, sessions=sessions, nudges={"LOOP-F35": {"alerts": {"cost-card:building": ago(2)}}})
        self.assertEqual(again["rows"]["LOOP-F35"]["action"], "none")

    def test_ok_cost_status_is_no_signal(self):
        st = state([{"id": "LOOP-F35", "spec": stamp(30)}])
        sessions = {"hermes-LOOP-F35": [{"role": "hermes-builder", "session_id": "sess-1", "cost_status": "unknown"}]}
        r = run(st, {"hermes-LOOP-F35": [builder_start("LOOP-F35", 29)]}, sessions=sessions)["rows"]["LOOP-F35"]
        self.assertFalse(r["cost_hold"])
        self.assertEqual(r["action"], "nudge")


class Cli(unittest.TestCase):
    def test_end_to_end_files(self):
        st = state([{"id": "LOOP-F35", "spec": stamp(11)}])
        with tempfile.TemporaryDirectory() as d:
            paths = {}
            for name, obj in (("state", st), ("threads", {"hermes-LOOP-F35": [builder_start("LOOP-F35", 10)]}), ("prs", []), ("nudges", {})):
                paths[name] = Path(d) / f"{name}.json"
                paths[name].write_text(json.dumps(obj))
            p = subprocess.run(
                [sys.executable, str(HERE / "hermes_supervise.py"), "--state", str(paths["state"]), "--threads", str(paths["threads"]),
                 "--prs", str(paths["prs"]), "--nudges", str(paths["nudges"]), "--now", NOW, "--json"],
                capture_output=True, text=True, check=False,
            )
        self.assertEqual(p.returncode, 0, p.stderr)
        out = json.loads(p.stdout)
        self.assertEqual(out["now"], NOW)
        self.assertEqual(out["rows"]["LOOP-F35"]["action"], "nudge")
        self.assertEqual(out["summary"]["must_nudge"], 1)

    def test_help(self):
        p = subprocess.run([sys.executable, str(HERE / "hermes_supervise.py"), "--help"], capture_output=True, text=True, check=False)
        self.assertEqual(p.returncode, 0)
        self.assertIn("--threads", p.stdout)


if __name__ == "__main__":
    unittest.main()


class NudgeTargetSessionTest(unittest.TestCase):
    """A nudge must land in the role's EXISTING session on the row (one live session per role per row)."""

    def test_pick_prefers_active_running_then_active_then_newest(self):
        rows = [
            {"role": "hermes-builder", "session_id": "sess-old", "status": "active", "container_status": "stopped", "last_active": "2026-09-10T07:40:00Z"},
            {"role": "hermes-builder", "session_id": "sess-live", "status": "active", "container_status": "running", "last_active": "2026-09-10T06:00:00Z"},
            {"role": "hermes-tester", "session_id": "sess-tester", "status": "active", "container_status": "running", "last_active": "2026-09-10T11:00:00Z"},
        ]
        self.assertEqual(hs.pick_target_session(rows, "hermes-builder")["session_id"], "sess-live")
        rows[1]["container_status"] = "stopped"
        self.assertEqual(hs.pick_target_session(rows, "hermes-builder")["session_id"], "sess-old")  # newest last_active
        rows[0]["status"] = "closed"
        self.assertEqual(hs.pick_target_session(rows, "hermes-builder")["session_id"], "sess-live")  # only active one
        self.assertIsNone(hs.pick_target_session(rows, "hermes-reviewer"))
        self.assertIsNone(hs.pick_target_session(None, "hermes-builder"))

    def test_nudge_action_carries_target_session_id(self):
        st = state([{"id": "LOOP-F35", "spec": stamp(11)}])
        threads = {"hermes-LOOP-F35": [spec_handoff("LOOP-F35", 11), builder_start("LOOP-F35", 10)]}
        sessions = {"hermes-LOOP-F35": [
            {"role": "hermes-builder", "session_id": "sess-nudge-twin", "cost_status": "unknown", "container_status": "stopped", "status": "active", "last_active": "2026-09-10T07:40:00Z"},
            {"role": "hermes-builder", "session_id": "sess-architect-created", "cost_status": "unknown", "container_status": "running", "status": "active", "last_active": "2026-09-10T06:00:00Z"},
        ]}
        out = run(st, threads, sessions=sessions)
        nudges = [a for a in out["actions"] if a["kind"] == "nudge" and a["row"] == "LOOP-F35"]
        self.assertEqual(len(nudges), 1, out["actions"])
        self.assertEqual(nudges[0]["target_session_id"], "sess-architect-created")
        self.assertIn("pin: existing hermes-builder session", nudges[0]["target_session_note"])
        self.assertEqual(out["rows"]["LOOP-F35"]["target_session_id"], "sess-architect-created")
        # No known session -> null pin, and the note says the send is unpinned.
        n2 = next(a for a in run(st, threads, sessions={})["actions"] if a["kind"] == "nudge")
        self.assertIsNone(n2["target_session_id"])
        self.assertIn("unpinned", n2["target_session_note"])


class RoundCapsV2(unittest.TestCase):
    """Round caps count in-plugin FAILs per review cycle (autopilot.md §5 / merge-gate.md): a
    `FAIL (env)` never counts, a `[Review Verdict] REQUEST_CHANGES` restarts the tester's budget,
    and `authorize_round` lifts only the current cycle by one."""

    HEAD_C = "c3d4e5f60718293a4b5c6d7e8f9012345678a1b2"
    HEAD_D = "d4e5f60718293a4b5c6d7e8f9012345678a1b2c3"

    def setUp(self):
        self.st = state([{"id": "LOOP-F35", "spec": stamp(30), "pr": "#2 (draft)"}])
        self.base = [spec_handoff("LOOP-F35", 30), builder_start("LOOP-F35", 29)]

    def test_env_fail_is_not_a_counted_round(self):
        threads = {"hermes-LOOP-F35": self.base + [
            handoff(2, HEAD_A, 20), test_report(2, HEAD_A, 1, "FAIL", 18),
            handoff(2, HEAD_B, 10, round_no=2),
            test_report(2, HEAD_B, 2, "FAIL (env) — recipient provider environment, outside plugin code", 3,
                        extra="- **Env cause:** _sanitize_subprocess_env strips the provider — tools/bot_mode_dm.py:364, r2-postonboard-probe.log"),
        ]}
        r = run(self.st, threads, prs=[pr(2, "LOOP-F35", HEAD_B, created_h=21)])["rows"]["LOOP-F35"]
        self.assertEqual((r["stage"], r["fail_count"], r["cycle_fail_count"]), ("testing", 1, 1))
        self.assertTrue(r["env_fail"])
        self.assertIn("FAIL (env)", r["reason"])

    def test_request_changes_restarts_the_test_budget(self):
        threads = {"hermes-LOOP-F35": self.base + [
            handoff(2, HEAD_A, 26), test_report(2, HEAD_A, 1, "FAIL", 24),
            handoff(2, HEAD_B, 22, round_no=2), test_report(2, HEAD_B, 2, "PASS", 20),
            review_verdict(2, HEAD_B, 1, "REQUEST_CHANGES", 18),
            handoff(2, self.HEAD_C, 16, round_no=2), test_report(2, self.HEAD_C, 1, "FAIL", 14),
        ]}
        r = run(self.st, threads, prs=[pr(2, "LOOP-F35", self.HEAD_C, created_h=27)])["rows"]["LOOP-F35"]
        # two FAILs on the PR, but only one in review cycle 1: the row keeps building
        self.assertEqual((r["stage"], r["fail_count"], r["cycle_fail_count"], r["review_cycle"]), ("building", 2, 1, 1))
        threads["hermes-LOOP-F35"] += [handoff(2, self.HEAD_D, 10, round_no=2), test_report(2, self.HEAD_D, 2, "FAIL", 8)]
        r = run(self.st, threads, prs=[pr(2, "LOOP-F35", self.HEAD_D, created_h=27)])["rows"]["LOOP-F35"]
        self.assertEqual(r["stage"], "blocked")
        self.assertIn("cap: test FAIL x2 in review cycle 1", r["reason"])

    def test_authorization_lifts_only_the_current_cycle(self):
        threads = {"hermes-LOOP-F35": self.base + [
            handoff(2, HEAD_A, 26), test_report(2, HEAD_A, 1, "PASS", 24),
            review_verdict(2, HEAD_A, 1, "REQUEST_CHANGES", 22),
            handoff(2, HEAD_B, 20, round_no=2), test_report(2, HEAD_B, 1, "FAIL", 18),
            handoff(2, self.HEAD_C, 16, round_no=2), test_report(2, self.HEAD_C, 2, "FAIL", 14),
        ]}
        prs = [pr(2, "LOOP-F35", self.HEAD_C, created_h=27)]
        self.assertEqual(run(self.st, threads, prs=prs)["rows"]["LOOP-F35"]["stage"], "blocked")
        cfg = {"authorize_round": {"LOOP-F35": "fixture fix named"}}
        self.assertEqual(run(self.st, threads, prs=prs, config=cfg)["rows"]["LOOP-F35"]["stage"], "building")
        threads["hermes-LOOP-F35"] += [handoff(2, self.HEAD_D, 10, round_no=2), test_report(2, self.HEAD_D, 3, "FAIL", 8)]
        r = run(self.st, threads, prs=[pr(2, "LOOP-F35", self.HEAD_D, created_h=27)], config=cfg)["rows"]["LOOP-F35"]
        self.assertEqual(r["stage"], "blocked")
        self.assertIn("round 3 used", r["reason"])


class EnvFailProof(unittest.TestCase):
    """A 'FAIL (env)' report is exempt from the cycle cap only with an '**Env cause:**' proof line
    (hermes-verify verdict rule); without it the supervisor counts it like any FAIL."""

    def setUp(self):
        self.st = state([{"id": "LOOP-F35", "spec": stamp(30), "pr": "#2 (draft)"}])
        self.base = [spec_handoff("LOOP-F35", 30), builder_start("LOOP-F35", 29)]

    def test_env_fail_without_proof_counts(self):
        threads = {"hermes-LOOP-F35": self.base + [
            handoff(2, HEAD_A, 20), test_report(2, HEAD_A, 1, "FAIL", 18),
            handoff(2, HEAD_B, 10, round_no=2), test_report(2, HEAD_B, 2, "FAIL (env) — provider environment", 3),
        ]}
        r = run(self.st, threads, prs=[pr(2, "LOOP-F35", HEAD_B, created_h=21)])["rows"]["LOOP-F35"]
        self.assertEqual((r["stage"], r["cycle_fail_count"]), ("blocked", 2))
        self.assertIn("cap: test FAIL x2", r["reason"])

    def test_env_fail_with_proof_is_exempt(self):
        proof = "- **Env cause:** tools/bot_mode_dm.py:316 spawns bare `hermes` — FileNotFoundError in r3-postonboard-probe.log"
        threads = {"hermes-LOOP-F35": self.base + [
            handoff(2, HEAD_A, 20), test_report(2, HEAD_A, 1, "FAIL", 18),
            handoff(2, HEAD_B, 10, round_no=2), test_report(2, HEAD_B, 2, "FAIL (env) — provider environment", 3, extra=proof),
        ]}
        r = run(self.st, threads, prs=[pr(2, "LOOP-F35", HEAD_B, created_h=21)])["rows"]["LOOP-F35"]
        self.assertEqual((r["stage"], r["cycle_fail_count"]), ("testing", 1))
        self.assertTrue(r["env_fail"])


# ledger.md § Carried criteria: LOOP-F35's fifth criterion, deferred onto MEM-F44 (hermes_queue reads it into `carries_criteria`).
CARRIED = (
    "\n## Carried criteria\n\n"
    "| criterion | from row | to row | reason | decided | status |\n"
    "| --- | --- | --- | --- | --- | --- |\n"
    "| AC-LOOP-F35-5 | LOOP-F35 | MEM-F44 | the retention key is proven where it is rendered | operator 2026-09-10 | open |\n"
)


def state_carried(rows: list[dict], carried: str = CARRIED, config: dict | None = None) -> dict:
    return hq.build_state(PLAN, MATRIX, ledger(rows) + carried, config=config, now=NOW)


class CarriedCriteria(unittest.TestCase):
    """The gate reminder names the ids the merge gate must see as PASS rows (P5), and a row merged
    while a criterion carried TO it is still open draws one alert (24 h bound)."""

    def setUp(self):
        self.rows = [merged_row("LOOP-F35", 2), {"id": "MEM-F44", "spec": stamp(28), "pr": "#3"}]
        self.chain = [spec_handoff("MEM-F44", 28), builder_start("MEM-F44", 27), handoff(3, HEAD_A, 20), test_report(3, HEAD_A, 1, "PASS", 15), review_verdict(3, HEAD_A, 1, "APPROVE", 5)]
        self.prs = [pr(3, "MEM-F44", HEAD_A, created_h=21)]

    def test_gate_action_names_the_carried_criteria(self):
        st = state_carried(self.rows)
        self.assertEqual([c["criterion"] for c in st["rows"]["MEM-F44"]["carries_criteria"]], ["AC-LOOP-F35-5"])
        threads = {"hermes-MEM-F44": self.chain + [triage("MEM-F44", 4.5)]}
        out = run(st, threads, prs=self.prs)
        r = out["rows"]["MEM-F44"]
        self.assertEqual((r["stage"], r["hold"], r["carries_criteria"]), ("gate", None, ["AC-LOOP-F35-5"]))
        gate = next(a for a in out["actions"] if a["kind"] == "gate")
        self.assertTrue(gate["text"].endswith("(MEM-F44); carried criteria to verify in the ADR/Test Report: AC-LOOP-F35-5"), gate["text"])
        self.assertEqual(gate["carried_criteria"], ["AC-LOOP-F35-5"])
        self.assertFalse(any(a["kind"] == "alert" for a in out["actions"]))  # not merged: no carried-open alert
        # without the table the gate text is what it was
        plain = run(state(self.rows), threads, prs=self.prs)
        g = next(a for a in plain["actions"] if a["kind"] == "gate")
        self.assertTrue(g["text"].endswith("(MEM-F44)"))
        self.assertNotIn("carried_criteria", g)
        self.assertEqual(plain["rows"]["MEM-F44"]["carries_criteria"], [])

    def test_gate_without_triage_still_carries_the_ids_on_the_record(self):
        r = run(state_carried(self.rows), {"hermes-MEM-F44": self.chain}, prs=self.prs)["rows"]["MEM-F44"]
        self.assertEqual((r["stage"], r["carries_criteria"]), ("gate", ["AC-LOOP-F35-5"]))

    def test_merged_with_open_carried_criterion_alerts_once(self):
        st = state_carried([merged_row("LOOP-F35", 2), merged_row("MEM-F44", 3)])
        out = run(st, {})
        r = out["rows"]["MEM-F44"]
        self.assertEqual((r["stage"], r["action"], r["alert_kind"]), ("merged", "escalate", "carried-open"))
        self.assertIn("merged with open carried criterion AC-LOOP-F35-5 — mark covered or re-carry", r["alert_line"])
        self.assertIn("MEM-F44 · merged 0h ·", r["alert_line"])
        self.assertIn("PR #3", r["alert_line"])
        self.assertIn("covered (<PR or head>)", r["alert_line"])
        alert = next(a for a in out["actions"] if a["kind"] == "alert")
        self.assertEqual((alert["row"], alert["alert_key"], alert["thread_id"]), ("MEM-F44", "carried-open:merged", "hermes-status"))
        self.assertNotIn("LOOP-F35", out["rows"])  # the from-row merging with a deferred criterion is the point, not a fault
        self.assertEqual((out["summary"]["escalate"], out["summary"]["in_flight"]), (1, 0))
        again = run(st, {}, nudges={"MEM-F44": {"alerts": {"carried-open:merged": ago(2)}}})
        self.assertEqual((again["rows"]["MEM-F44"]["action"], again["rows"]["MEM-F44"]["slo_status"]), ("none", "escalated"))
        self.assertEqual(again["alerts"], [])

    def test_fork_merged_this_tick_also_alerts(self):
        out = run(state_carried(self.rows), {"hermes-MEM-F44": self.chain}, prs=[pr(3, "MEM-F44", HEAD_A, "MERGED", created_h=21)])
        r = out["rows"]["MEM-F44"]
        self.assertEqual((r["stage"], r["action"], r["alert_kind"]), ("merged", "escalate", "carried-open"))
        self.assertEqual(len([a for a in out["actions"] if a["kind"] == "alert"]), 1)

    def test_covered_or_dropped_criterion_is_quiet(self):
        for status in ("covered (#3)", "dropped (superseded)"):
            st = state_carried([merged_row("LOOP-F35", 2), merged_row("MEM-F44", 3)], CARRIED.replace("| open |", f"| {status} |"))
            out = run(st, {})
            self.assertNotIn("MEM-F44", out["rows"])
            self.assertEqual(out["actions"], [])


# --- §2.5: the stall shapes the chain markers do not show (the 2026-09-15/16 stalls) -----------------------

HOLD_ARCH = (
    "HOLD on CRED-F28 — please PAUSE the builder dispatch: the orchestrator is holding my [Spec handoff] "
    "pending an **operator ruling** on the credential seam."
)
HOLD_TESTER = (
    "Hold (NOT a verdict — the gated [Test Report] is withheld): the codex OUTPUT_REVIEW endpoint has been "
    "failing for 30+ min — AzureException BadRequestError: Unknown parameter 'client_metadata'"
)
HOLD_BUILDER = "blocked (infra, not a defect): the chain is stalled on a fleet-wide codex fault — please relay to the orchestrator/operator."
ACKS_OFF = "acks stale/missing — bounce and idle detection off"


def acks(*entries: tuple, generated_h: float = 0.1) -> dict:
    """acks.json as collect-acks.sh writes it: (session_id, status, changed_hours_ago, role, thread_id[, extra])."""
    sessions = {}
    for e in entries:
        sessions[e[0]] = {"status": e[1], "changed": ago(e[2]), "role": e[3], "thread_id": e[4], **(e[5] if len(e) > 5 else {})}
    return {"generated_at": ago(generated_h), "sessions": sessions}


def dispatched_row(rid: str, hours: float) -> tuple[dict, list[dict]]:
    st = state([{"id": rid, "dispatched": stamp(hours) + " (to hermes-architect)"}])
    return st, [msg(hours, f"Dispatch {rid}: title.", "in")]


class InfraHold(unittest.TestCase):
    """CRED-F28 / A2A-F21, 2026-09-15/16: a role wrote a hold instead of its marker. The stage is unchanged;
    the operator is alerted at once; the Orchestrator is asked (once per hold) to re-arm the role."""

    def test_architect_operator_ruling_alerts_and_asks_orchestrator(self):
        st, base = dispatched_row("CRED-F28", 4)
        out = run(st, {"hermes-CRED-F28": base + [msg(3, HOLD_ARCH, sender="hermes-architect")]})
        r = out["rows"]["CRED-F28"]
        self.assertEqual((r["stage"], r["age_hours"]), ("dispatched", 4.0))  # the stage and its clock are untouched
        self.assertEqual((r["alert_kind"], r["slo_status"]), ("operator-ruling", "infra-hold"))
        ih = r["infra_hold"]
        self.assertEqual((ih["role"], ih["operator_ruling"], ih["cause"], ih["ts"]), ("hermes-architect", True, None, ago(3)))
        self.assertTrue(ih["text"].startswith("HOLD on CRED-F28 — please PAUSE"))
        self.assertNotIn("**", ih["text"])
        self.assertIn("hermes-architect wrote: HOLD on CRED-F28", r["alert_line"])
        self.assertIn("· decision: post the ruling on hermes-CRED-F28 ·", r["alert_line"])
        alert = next(a for a in out["actions"] if a["kind"] == "alert")
        self.assertEqual((alert["alert_kind"], alert["alert_key"], alert["thread_id"]), ("operator-ruling", "operator-ruling:dispatched", "hermes-status"))
        nudge = next(a for a in out["actions"] if a["kind"] == "nudge")
        self.assertEqual((nudge["target_role"], nudge["check"], nudge["rearm_role"], nudge["alert_kind"]), ("orchestrator", "infra_hold", "hermes-architect", "operator-ruling"))
        # both texts name the ROLE in their prefix (an architect re-arm is never read as the builder's) and carry the
        # hold KEY — the normalised first line, ≤ 80 chars — which is what bounds the re-arm, not the hold's timestamp
        key = hs._hold_key("hermes-architect", ih["text"])
        self.assertEqual(key, 'hold "HOLD on CRED-F28 — please PAUSE the builder dispatch: the orchestrator is holdin"')  # 80 chars, normalised
        self.assertEqual(nudge["hold_key"], key)
        self.assertTrue(nudge["text"].startswith(f"Supervisor re-arm CRED-F28 · hermes-architect: operator ruling — hermes-architect wrote {key} at {ago(3)}"), nudge["text"])
        self.assertIn("re-arm hermes-architect there with 'resume, no new round'", nudge["text"])
        self.assertTrue(nudge["rearm_text"].startswith("Supervisor re-arm CRED-F28 · hermes-architect: resume, no new round"), nudge["rearm_text"])
        self.assertIn(f"your {key} (at {ago(3)}) is lifted", nudge["rearm_text"])
        self.assertEqual((out["summary"]["infra_hold"], out["summary"]["escalate"], out["summary"]["must_nudge"]), (1, 1, 1))

    def test_tester_and_builder_infra_phrases_name_the_codex_cause(self):
        st, base = dispatched_row("A2A-F21", 4)
        threads = {"hermes-A2A-F21": base + [msg(3, HOLD_TESTER, sender="hermes-tester"), msg(2.5, HOLD_BUILDER, sender="hermes-builder")]}
        out = run(st, threads)
        r = out["rows"]["A2A-F21"]
        self.assertEqual((r["stage"], r["alert_kind"]), ("dispatched", "infra-hold"))
        ih = r["infra_hold"]
        self.assertEqual((ih["role"], ih["count"], ih["roles"], ih["operator_ruling"]), ("hermes-builder", 2, ["hermes-builder", "hermes-tester"], False))
        self.assertTrue(ih["text"].startswith("blocked (infra, not a defect)"), ih["text"])
        # two holds stand: the most descriptive `codex …` phrase names the dependency
        self.assertTrue(ih["cause"].startswith("OUTPUT_REVIEW endpoint has been failing for 30+ min"), ih["cause"])
        self.assertIn("decision: check the named dependency (codex: OUTPUT_REVIEW endpoint", r["alert_line"])
        self.assertIn("re-arm hermes-builder on hermes-A2A-F21 with 'resume, no new round'", r["alert_line"])
        nudge = next(a for a in out["actions"] if a["kind"] == "nudge")
        self.assertEqual((nudge["target_role"], nudge["check"], nudge["rearm_role"], nudge["alert_kind"]), ("orchestrator", "infra_hold", "hermes-builder", "infra-hold"))
        self.assertIn("codex OUTPUT_REVIEW endpoint", nudge["text"])
        self.assertIn("once it is healthy re-arm hermes-builder on hermes-A2A-F21", nudge["text"])
        # each phrase alone is a hold by the role that wrote it
        for text, role in ((HOLD_TESTER, "hermes-tester"), (HOLD_BUILDER, "hermes-builder"), (HOLD_ARCH.replace("CRED-F28", "A2A-F21"), "hermes-architect")):
            rr = run(st, {"hermes-A2A-F21": base + [msg(2, text, sender=role)]})["rows"]["A2A-F21"]
            self.assertEqual(rr["infra_hold"]["role"], role, text)
            self.assertEqual(rr["alert_kind"], "operator-ruling" if role == "hermes-architect" else "infra-hold", text)
        # case-insensitive, and the operator phrase anywhere in the first three lines counts
        rr = run(st, {"hermes-A2A-F21": base + [msg(2, "Status update\nwork parked\nawaiting an operator decision on the seam", sender="hermes-builder")]})["rows"]["A2A-F21"]
        self.assertEqual(rr["infra_hold"]["role"], "hermes-builder")
        rr = run(st, {"hermes-A2A-F21": base + [msg(2, "BLOCKED (INFRA): proxy down", sender="hermes-builder")]})["rows"]["A2A-F21"]
        self.assertEqual(rr["alert_kind"], "infra-hold")

    def test_inbound_copies_and_ordinary_lines_are_not_holds(self):
        st, base = dispatched_row("A2A-F21", 4)
        threads = {"hermes-A2A-F21": base + [
            msg(3, HOLD_TESTER, "in", sender="hermes-tester"),  # the receiver's copy of a send is not this role's hold
            msg(2, "holding pattern: still running scenarios, ETA 1 h", sender="hermes-tester"),
            msg(1.5, "Status\n\nscenario 3 of 6 green\n\nlogs attached\nfourth non-empty line: awaiting operator input", sender="hermes-tester"),  # beyond the first three non-empty lines
        ]}
        r = run(st, threads)["rows"]["A2A-F21"]
        self.assertIsNone(r["infra_hold"])
        self.assertIsNone(r["alert_kind"])
        self.assertEqual(r["action"], "none")

    def test_later_marker_clears_the_hold(self):
        st, base = dispatched_row("CRED-F28", 5)
        threads = {"hermes-CRED-F28": base + [msg(4, HOLD_ARCH, sender="hermes-architect"), spec_handoff("CRED-F28", 1)]}
        out = run(st, threads)
        r = out["rows"]["CRED-F28"]
        self.assertIsNone(r["infra_hold"])
        self.assertEqual((r["stage"], r["action"]), ("spec_handoff", "none"))
        self.assertEqual(out["actions"], [])
        self.assertEqual(out["summary"]["infra_hold"], 0)
        # a hold AFTER the marker stands again
        threads["hermes-CRED-F28"].append(msg(0.5, HOLD_ARCH, sender="hermes-architect"))
        out2 = run(st, threads)
        self.assertEqual(out2["rows"]["CRED-F28"]["infra_hold"]["ts"], ago(0.5))
        self.assertEqual(out2["rows"]["CRED-F28"]["stage"], "spec_handoff")

    def test_bounded_once_per_hold_event_and_24h_per_alert(self):
        st, base = dispatched_row("CRED-F28", 4)
        hold = msg(3, HOLD_ARCH, sender="hermes-architect")
        first = run(st, {"hermes-CRED-F28": base + [hold]})
        rearm = next(a for a in first["actions"] if a["kind"] == "nudge")
        # next tick: the alert is in the book and the re-arm text was recorded (record.py nudged) -> quiet
        book = {"CRED-F28": {"alerts": {"operator-ruling:dispatched": ago(1)}, "texts": [rearm["rearm_text"]]}}
        again = run(st, {"hermes-CRED-F28": base + [hold]}, nudges=book)
        self.assertEqual(again["actions"], [])
        self.assertEqual((again["rows"]["CRED-F28"]["slo_status"], again["summary"]["must_nudge"], again["summary"]["escalate"]), ("infra-hold", 0, 0))
        self.assertIsNotNone(again["rows"]["CRED-F28"]["infra_hold"])  # still on the status table
        # the re-arm read back from the thread (the role's inbound copy) bounds it too; so does the Orchestrator-facing text
        for line in (rearm["rearm_text"], rearm["text"]):
            seen = run(st, {"hermes-CRED-F28": base + [hold, msg(0.5, line, "in", sender="orchestrator")]},
                       nudges={"CRED-F28": {"alerts": {"operator-ruling:dispatched": ago(1)}}})
            self.assertEqual(seen["actions"], [], line)
        # a RESTATEMENT of the same hold (later ts, same first line) is the same hold: nothing new, however often the
        # role repeats it during a long outage; the newest restatement is still what the status table shows
        restated = run(st, {"hermes-CRED-F28": base + [hold, msg(0.5, HOLD_ARCH, sender="hermes-architect")]}, nudges=book)
        self.assertEqual(restated["actions"], [])
        self.assertEqual(restated["rows"]["CRED-F28"]["infra_hold"]["ts"], ago(0.5))
        # a differently WORDED hold is a new hold text -> a new re-arm (the alert stays bound for 24 h) ...
        reworded = HOLD_ARCH.replace("please PAUSE the builder dispatch", "still parked, codex 401s since 09:00")
        newer = run(st, {"hermes-CRED-F28": base + [hold, msg(0.5, reworded, sender="hermes-architect")]}, nudges=book)
        self.assertEqual([a["kind"] for a in newer["actions"]], ["nudge"])
        self.assertIn(f"{hs._hold_key('hermes-architect', hs._strip_md(reworded))} at {ago(0.5)}", newer["actions"][0]["text"])
        # ... unless a re-arm to this role was SENT inside the last 6 h: the per-(row, role) cap, read from the recorded
        # `rearms` (with their `at`) or from the role's `in` copy on the thread (its ts). It lifts after 6 h.
        timed = {"CRED-F28": {**book["CRED-F28"], "rearms": [{"at": ago(1), "text": rearm["rearm_text"]}]}}
        capped = run(st, {"hermes-CRED-F28": base + [hold, msg(0.5, reworded, sender="hermes-architect")]}, nudges=timed)
        self.assertEqual(capped["actions"], [])
        self.assertIn("re-arm cap: hermes-architect re-armed 1.0h ago (< 6h)", capped["rows"]["CRED-F28"]["reason"])
        on_thread = run(st, {"hermes-CRED-F28": base + [hold, msg(1, rearm["rearm_text"], "in", sender="orchestrator"), msg(0.5, reworded, sender="hermes-architect")]}, nudges=book)
        self.assertEqual(on_thread["actions"], [])
        timed["CRED-F28"]["rearms"] = [{"at": ago(7), "text": rearm["rearm_text"]}]
        lifted = run(st, {"hermes-CRED-F28": base + [hold, msg(0.5, reworded, sender="hermes-architect")]}, nudges=timed)
        self.assertEqual([a["kind"] for a in lifted["actions"]], ["nudge"])
        # the alert re-arms after 24 h
        old = run(st, {"hermes-CRED-F28": base + [hold]}, nudges={"CRED-F28": {"alerts": {"operator-ruling:dispatched": ago(25)}, "texts": [rearm["rearm_text"]]}})
        self.assertEqual([a["kind"] for a in old["actions"]], ["alert"])
        # a re-arm is not a 6 h-bound nudge: a regular nudge 1 h ago does not block it
        recent = run(st, {"hermes-CRED-F28": base + [hold]}, nudges={"CRED-F28": {"last_nudge": ago(1), "state": "dispatched", "count": 1}})
        self.assertEqual([a["kind"] for a in recent["actions"] if a["kind"] == "nudge"], ["nudge"])
        # and the re-arm line on the thread is not classified as a nudge (the row's 6 h bound is untouched)
        r = run(st, {"hermes-CRED-F28": base + [hold, msg(0.5, rearm["rearm_text"], "in", sender="orchestrator")]})["rows"]["CRED-F28"]
        self.assertEqual((r["nudges"]["count"], r["nudges"]["last"]), (0, None))

    def test_hold_on_a_merge_held_or_cost_held_row(self):
        # cost hold wins (the container cannot take a turn); an infra hold on a merge-held gate row still alerts
        st, base = dispatched_row("CRED-F28", 4)
        sessions = {"hermes-CRED-F28": [{"role": "hermes-architect", "session_id": "s-1", "cost_status": "stopped", "container_status": "stopped"}]}
        r = run(st, {"hermes-CRED-F28": base + [msg(3, HOLD_ARCH, sender="hermes-architect")]}, sessions=sessions)["rows"]["CRED-F28"]
        self.assertEqual(r["alert_kind"], "cost-card")
        self.assertIsNone(r["infra_hold"])

    def test_paused_row_with_a_hold_is_silent(self):
        # the operator paused the row: a stale `HOLD on CRED-F28` line must not alert or re-arm anything
        st, base = dispatched_row("CRED-F28", 4)
        out = run(st, {"hermes-CRED-F28": base + [msg(3, HOLD_ARCH, sender="hermes-architect")]}, config={"paused_rows": ["CRED-F28"]})
        r = out["rows"]["CRED-F28"]
        self.assertEqual((r["hold"], r["action"], r["alert_kind"], r["infra_hold"]), ("paused", "none", None, None))
        self.assertEqual([a["kind"] for a in out["actions"]], ["hold"])
        self.assertEqual((out["summary"]["infra_hold"], out["summary"]["escalate"], out["summary"]["must_nudge"], out["summary"]["hold"]), (0, 0, 0, 1))

    def test_later_plain_line_by_the_holding_role_clears_the_hold(self):
        # the builder wrote the hold, then `codex is back — resuming`: it moved on; re-arming it would interrupt live work
        st, base = dispatched_row("A2A-F21", 6)
        hold = msg(5, HOLD_BUILDER, sender="hermes-builder")
        resumed = run(st, {"hermes-A2A-F21": base + [hold, msg(4, "codex is back — resuming the build, ETA 2h", sender="hermes-builder")]})
        r = resumed["rows"]["A2A-F21"]
        self.assertEqual((r["infra_hold"], r["alert_kind"], r["stage"]), (None, None, "dispatched"))
        self.assertEqual([a["kind"] for a in resumed["actions"]], ["nudge"])  # 6 h on `dispatched`: the ORDINARY SLO nudge, nothing else
        self.assertNotIn("check", resumed["actions"][0])
        self.assertEqual(resumed["summary"]["infra_hold"], 0)
        # a `PR opened` line clears it too (pr_opened is a progress kind now), and the stage advances
        opened = run(st, {"hermes-A2A-F21": base + [hold, msg(4, f"PR opened {SLUG}#7 (draft)", sender="hermes-builder")]})
        self.assertEqual((opened["rows"]["A2A-F21"]["infra_hold"], opened["rows"]["A2A-F21"]["stage"]), (None, "pr_open"))
        # what does NOT clear it: another role's line, the receiver's `in` copy, a supervisor line, or a restatement of the hold
        for later in (
            msg(4, "tester here: still waiting on the builder", sender="hermes-tester"),
            msg(4, "codex is back — resuming", "in", sender="hermes-builder"),
            msg(4, "Supervisor nudge A2A-F21: dispatched for 5h, no [Spec handoff]. Expected next: x", "in", sender="orchestrator"),
            msg(4, HOLD_BUILDER, sender="hermes-builder"),
        ):
            rr = run(st, {"hermes-A2A-F21": base + [hold, later]})["rows"]["A2A-F21"]
            self.assertIsNotNone(rr["infra_hold"], later["text"])
            self.assertEqual(rr["alert_kind"], "infra-hold", later["text"])

    def test_a_standing_hold_does_not_hide_the_slo_check(self):
        # the re-arm was sent hours ago and the row is past its escalation SLO: the `slo` alert still fires
        st, base = dispatched_row("CRED-F28", 13)  # dispatched: nudge 6 h, escalate 12 h
        hold = msg(12, HOLD_ARCH, sender="hermes-architect")
        rearm = next(a for a in run(st, {"hermes-CRED-F28": base + [hold]})["actions"] if a["kind"] == "nudge")["rearm_text"]
        book = {"CRED-F28": {"last_nudge": ago(6.5), "state": "dispatched", "count": 1, "alerts": {"operator-ruling:dispatched": ago(12)},
                             "texts": [rearm], "rearms": [{"at": ago(11), "text": rearm}]}}
        out = run(st, {"hermes-CRED-F28": base + [hold, msg(11, rearm, "in", sender="orchestrator"), msg(9.5, "resuming per the ruling", sender="hermes-architect")]}, nudges=book)
        r = out["rows"]["CRED-F28"]
        self.assertIsNone(r["infra_hold"])  # the architect wrote after the hold: it is history ...
        self.assertEqual((r["slo_breach"], r["escalation_due"], r["alert_kind"], r["slo_status"]), (True, True, "slo", "escalated"))
        self.assertEqual([a["alert_kind"] for a in out["actions"] if a["kind"] == "alert"], ["slo"])
        # ... and with the hold still standing (nothing written since) the SLO check runs all the same
        standing = run(st, {"hermes-CRED-F28": base + [hold, msg(11, rearm, "in", sender="orchestrator")]}, nudges=book)
        r2 = standing["rows"]["CRED-F28"]
        self.assertIsNotNone(r2["infra_hold"])
        self.assertEqual((r2["slo_breach"], r2["escalation_due"], r2["alert_kind"]), (True, True, "slo"))
        self.assertEqual([a["alert_kind"] for a in standing["actions"] if a["kind"] == "alert"], ["slo"])
        self.assertEqual(standing["summary"]["must_nudge"], 0)  # the re-arm is bounded (same hold text); no ordinary nudge inside 6 h
        # no prior nudge, 7 h in, re-arm already sent: the ORDINARY SLO nudge to the architect fires (not a second re-arm)
        st7, base7 = dispatched_row("CRED-F28", 7)
        seven = run(st7, {"hermes-CRED-F28": base7 + [msg(6.5, HOLD_ARCH, sender="hermes-architect"), msg(6, rearm, "in", sender="orchestrator")]},
                    nudges={"CRED-F28": {"alerts": {"operator-ruling:dispatched": ago(6.5)}, "texts": [rearm], "rearms": [{"at": ago(6.4), "text": rearm}]}})
        nudges = [a for a in seven["actions"] if a["kind"] == "nudge"]
        self.assertEqual([(n["target_role"], n.get("check")) for n in nudges], [("hermes-architect", None)])
        self.assertEqual((seven["rows"]["CRED-F28"]["slo_breach"], seven["rows"]["CRED-F28"]["slo_status"]), (True, "breached"))
        self.assertIsNotNone(seven["rows"]["CRED-F28"]["infra_hold"])  # the standing hold stays on the status table


class BouncedTurn(unittest.TestCase):
    """ISO-F14, 2026-09-15: the architect acked the operator addendum, its turn ended `bounced-transient` with
    no output, and nothing re-armed it for 19 h. The ack, not the thread, is the only evidence."""

    def setUp(self):
        self.st, base = dispatched_row("ISO-F14", 4)
        self.threads = {"hermes-ISO-F14": base + [msg(3.5, "ack — addendum noted, resuming", sender="hermes-architect")]}
        self.sessions = {"hermes-ISO-F14": [
            {"role": "hermes-architect", "session_id": "s-a14", "cost_status": "ok", "container_status": "stopped", "status": "active"},
            {"role": "orchestrator", "session_id": "s-o14", "cost_status": "ok", "container_status": "stopped", "status": "active"},
        ]}
        self.bounce = ("s-a14", "bounced-transient", 3.0, "hermes-architect", "hermes-ISO-F14")

    def test_bounced_ack_newer_than_the_roles_last_line_nudges_the_orchestrator_at_once(self):
        out = run(self.st, self.threads, sessions=self.sessions, acks=acks(self.bounce))
        r = out["rows"]["ISO-F14"]
        self.assertEqual((r["stage"], r["age_hours"], r["slo_breach"]), ("dispatched", 4.0, False))  # 4 h < 6 h: no ordinary nudge yet
        self.assertEqual(r["bounced"], {"role": "hermes-architect", "session_id": "s-a14", "status": "bounced-transient", "changed": ago(3.0), "repeat": False, "after_rearm_for": None})
        self.assertEqual((r["slo_status"], r["alert_kind"]), ("bounced", None))
        n = next(a for a in out["actions"] if a["kind"] == "nudge")
        self.assertEqual((n["target_role"], n["check"], n["rearm_role"], n["rearm_session_id"], n["repeat"]), ("orchestrator", "bounced", "hermes-architect", "s-a14", False))
        self.assertEqual(n["target_session_id"], "s-o14")  # the Orchestrator's own row session is the pin
        # bounced-transient is the provider-outage signature: the Orchestrator probes first and never spawns fresh for it
        self.assertTrue(n["text"].startswith(
            f"Supervisor re-arm ISO-F14 · hermes-architect: re-arm hermes-architect on hermes-ISO-F14: its last turn at {ago(3.0)} ended "
            "bounced-transient with no output; this is the provider-outage signature: probe the provider first"), n["text"])
        self.assertIn("Never spawn a fresh session for a transient bounce; reply on this thread.", n["text"])
        self.assertEqual((n["transient"], n["ack_status"]), (True, "bounced-transient"))
        self.assertTrue(n["rearm_text"].startswith("Supervisor re-arm ISO-F14 · hermes-architect: resume, no new round"), n["rearm_text"])
        self.assertIn(f"turn at {ago(3.0)} ended bounced-transient", n["rearm_text"])
        self.assertEqual((out["summary"]["bounced"], out["summary"]["must_nudge"], out["summary"]["escalate"]), (1, 1, 0))
        self.assertFalse(any(a["kind"] == "alert" for a in out["actions"]))
        # `bounced-unknown` is a bounce too — the one kind that may fall back to a fresh session; a fractional-second ack timestamp is normalised
        ak = acks(("s-a14", "bounced-unknown", 3.0, "hermes-architect", "hermes-ISO-F14"))
        ak["sessions"]["s-a14"]["changed"] = ago(3.0).replace("Z", ".123Z")
        out2 = run(self.st, self.threads, sessions=self.sessions, acks=ak)
        r2 = out2["rows"]["ISO-F14"]
        self.assertEqual((r2["bounced"]["status"], r2["bounced"]["changed"]), ("bounced-unknown", ago(3.0)))
        n2 = next(a for a in out2["actions"] if a["kind"] == "nudge")
        self.assertIn("resume the warm session if it accepts a message, else spawn fresh; reply on this thread.", n2["text"])
        self.assertEqual((n2["transient"], n2["ack_status"]), (False, "bounced-unknown"))

    def test_same_acks_next_tick_is_quiet_then_a_later_bounce_is_bounce_repeat(self):
        first = run(self.st, self.threads, sessions=self.sessions, acks=acks(self.bounce))
        rearm = next(a for a in first["actions"] if a["kind"] == "nudge")["rearm_text"]
        # the re-arm landed in the architect's session (its `in` copy): same acks, no second nudge
        threads = {"hermes-ISO-F14": self.threads["hermes-ISO-F14"] + [msg(2.5, rearm, "in", sender="orchestrator")]}
        again = run(self.st, threads, sessions=self.sessions, acks=acks(self.bounce))
        self.assertEqual(again["actions"], [])
        self.assertEqual(again["rows"]["ISO-F14"]["bounced"]["changed"], ago(3.0))  # still reported
        # the recorded text alone (nudges.json -> book texts) bounds it as well
        booked = run(self.st, self.threads, sessions=self.sessions, acks=acks(self.bounce), nudges={"ISO-F14": {"texts": [rearm]}})
        self.assertEqual(booked["actions"], [])
        # a later bounce after the re-arm was SENT: the bounce-repeat ALERT and nothing else — no second re-arm. Every
        # redrive during an outage mints a new bounced-* ack; re-arming per ack would open a fresh session per tick.
        later = ("s-a14", "bounced-transient", 1.0, "hermes-architect", "hermes-ISO-F14")
        rep = run(self.st, threads, sessions=self.sessions, acks=acks(later))
        r = rep["rows"]["ISO-F14"]
        self.assertEqual((r["bounced"]["repeat"], r["bounced"]["after_rearm_for"], r["bounced"]["changed"]), (True, ago(3.0), ago(1.0)))
        self.assertEqual((r["alert_kind"], r["action"], r["slo_status"]), ("bounce-repeat", "escalate", "escalated"))
        self.assertIn(f"after the re-arm for its bounce at {ago(3.0)}; no further re-arm from the supervisor", r["alert_line"])
        # transient: the decision is to wait for the provider, then spawn fresh BY HAND
        self.assertIn(f"decision: the provider outage (bounced-transient) is still on: check the host error log around {ago(1.0)}, "
                      "and when the provider is back spawn a fresh hermes-architect session by hand", r["alert_line"])
        self.assertEqual([a["kind"] for a in rep["actions"]], ["alert"])
        self.assertEqual((rep["summary"]["escalate"], rep["summary"]["must_nudge"], rep["summary"]["bounced"]), (1, 0, 1))
        # bounced-unknown repeat: spawn fresh by hand, the host error log has the provider/proxy error
        unk = run(self.st, threads, sessions=self.sessions, acks=acks(("s-a14", "bounced-unknown", 1.0, "hermes-architect", "hermes-ISO-F14")))
        self.assertIn(f"decision: spawn a fresh hermes-architect session by hand; check the host error log around {ago(1.0)} for the provider/proxy error",
                      unk["rows"]["ISO-F14"]["alert_line"])
        self.assertEqual([a["kind"] for a in unk["actions"]], ["alert"])
        # the repeat alert is 24 h bound like every alert: the third tick of the outage is quiet, the row still says bounced
        quiet = run(self.st, threads, sessions=self.sessions, acks=acks(later), nudges={"ISO-F14": {"alerts": {"bounce-repeat:dispatched": ago(0.4)}}})
        self.assertEqual(quiet["actions"], [])
        self.assertEqual((quiet["rows"]["ISO-F14"]["bounced"]["repeat"], quiet["rows"]["ISO-F14"]["slo_status"]), (True, "escalated"))
        # yet another bounce (the outage goes on): still no re-arm, whatever the ack timestamp
        third = run(self.st, threads, sessions=self.sessions, acks=acks(("s-a14", "bounced-transient", 0.2, "hermes-architect", "hermes-ISO-F14")),
                    nudges={"ISO-F14": {"alerts": {"bounce-repeat:dispatched": ago(0.4)}}})
        self.assertEqual(third["actions"], [])

    def test_another_roles_rearm_is_not_this_roles_repeat(self):
        # a BUILDER re-arm on the thread (its bounce at 4 h ago) must not make the architect's FIRST bounce a repeat
        builder_rearm = (
            f"Supervisor re-arm ISO-F14 · hermes-builder: resume, no new round — your last turn at {ago(4.0)} ended bounced-transient "
            "with no output on thread hermes-ISO-F14. Re-read your task memory, pick up where that turn stopped, and reply on this thread: status, blocker, ETA."
        )
        threads = {"hermes-ISO-F14": self.threads["hermes-ISO-F14"] + [msg(3.9, builder_rearm, "in", sender="orchestrator")]}
        out = run(self.st, threads, sessions=self.sessions, acks=acks(self.bounce), nudges={"ISO-F14": {"texts": [builder_rearm], "rearms": [{"at": ago(3.9), "text": builder_rearm}]}})
        r = out["rows"]["ISO-F14"]
        self.assertEqual((r["bounced"]["repeat"], r["bounced"]["after_rearm_for"], r["alert_kind"]), (False, None, None))
        self.assertEqual([(a["kind"], a.get("rearm_role")) for a in out["actions"]], [("nudge", "hermes-architect")])
        # and the builder's re-arm inside 6 h is not the architect's cap either
        self.assertNotIn("re-arm cap", r["reason"] or "")

    def test_one_sent_rearm_per_row_and_role_per_6h(self):
        # an infra-hold re-arm to the architect was sent 1 h ago; now its turn bounces: no second re-arm inside the window
        infra_rearm = (
            f"Supervisor re-arm ISO-F14 · hermes-architect: resume, no new round — your hold \"HOLD on ISO-F14 — parked\" (at {ago(2)}) is lifted: "
            "the dependency is back. Pick up where you stopped and reply on this thread: status, blocker, ETA."
        )
        book = {"ISO-F14": {"texts": [infra_rearm], "rearms": [{"at": ago(1), "text": infra_rearm}]}}
        out = run(self.st, self.threads, sessions=self.sessions, acks=acks(self.bounce), nudges=book)
        r = out["rows"]["ISO-F14"]
        self.assertEqual((r["bounced"]["status"], r["bounced"]["repeat"], r["action"]), ("bounced-transient", False, "none"))
        self.assertIn("re-arm cap: hermes-architect re-armed 1.0h ago (< 6h)", r["reason"])
        self.assertEqual((out["actions"], out["summary"]["bounced"], out["summary"]["must_nudge"]), ([], 1, 0))
        # the role's `in` copy on the thread (with its ts) is the same evidence; untimed `texts` alone are not
        on_thread = run(self.st, {"hermes-ISO-F14": self.threads["hermes-ISO-F14"] + [msg(1, infra_rearm, "in", sender="orchestrator")]}, sessions=self.sessions, acks=acks(self.bounce))
        self.assertEqual(on_thread["actions"], [])
        untimed = run(self.st, self.threads, sessions=self.sessions, acks=acks(self.bounce), nudges={"ISO-F14": {"texts": [infra_rearm]}})
        self.assertEqual([a["kind"] for a in untimed["actions"]], ["nudge"])
        # the cap lifts after 6 h
        book["ISO-F14"]["rearms"] = [{"at": ago(6.5), "text": infra_rearm}]
        lifted = run(self.st, self.threads, sessions=self.sessions, acks=acks(self.bounce), nudges=book)
        self.assertEqual([a.get("check") for a in lifted["actions"]], ["bounced"])

    def test_bounce_older_than_the_roles_last_line_is_not_a_bounce(self):
        # the architect wrote after the bounce: it recovered on its own
        ak = acks(("s-a14", "bounced-transient", 3.8, "hermes-architect", "hermes-ISO-F14"))
        out = run(self.st, self.threads, sessions=self.sessions, acks=ak)
        self.assertIsNone(out["rows"]["ISO-F14"]["bounced"])
        self.assertEqual(out["actions"], [])
        self.assertEqual(out["summary"]["bounced"], 0)

    def test_bounces_of_other_roles_or_threads_and_older_sessions_are_ignored(self):
        ak = acks(("s-b14", "bounced-unknown", 1.0, "hermes-builder", "hermes-ISO-F14"),
                  ("s-a13", "bounced-transient", 1.0, "hermes-architect", "hermes-ISO-F13"))
        out = run(self.st, self.threads, sessions=self.sessions, acks=ak)
        self.assertIsNone(out["rows"]["ISO-F14"]["bounced"])
        self.assertEqual(out["actions"], [])
        # two architect sessions on the thread: the NEWEST ack decides (a completed newer one hides the old bounce)
        ak2 = acks(("s-a14-old", "bounced-transient", 3.0, "hermes-architect", "hermes-ISO-F14"),
                   ("s-a14", "completed", 2.0, "hermes-architect", "hermes-ISO-F14"))
        r = run(self.st, self.threads, sessions=self.sessions, acks=ak2)["rows"]["ISO-F14"]
        self.assertIsNone(r["bounced"])


class BounceHistory(unittest.TestCase):
    """ISO-F14, 2026-09-16: the architect bounced three times in 66 min; the host sweep re-armed it each time and
    cleared the bounced ack it retried, so acks.json read `completed` / `processing` at every tick and the repeat was
    never raised. collect-acks.sh now counts the host's re-arm log lines per session (`bounces_24h`)."""

    def setUp(self):
        self.st, base = dispatched_row("ISO-F14", 4)
        self.threads = {"hermes-ISO-F14": base + [msg(3.5, "ack — addendum noted, resuming", sender="hermes-architect")]}
        self.sessions = {"hermes-ISO-F14": [
            {"role": "hermes-architect", "session_id": "s-a14", "cost_status": "ok", "container_status": "stopped", "status": "active"},
            {"role": "orchestrator", "session_id": "s-o14", "cost_status": "ok", "container_status": "stopped", "status": "active"},
        ]}

    def hist(self, status: str, changed_h: float, n, last_h: float | None = 1.0) -> dict:
        extra = {"bounces_24h": n, "last_bounce_at": ago(last_h) if last_h is not None else None}
        return acks(("s-a14", status, changed_h, "hermes-architect", "hermes-ISO-F14", extra))

    def test_two_host_rearms_with_a_completed_ack_is_bounce_repeat_once(self):
        out = run(self.st, self.threads, sessions=self.sessions, acks=self.hist("completed", 2.0, 2))
        r = out["rows"]["ISO-F14"]
        self.assertEqual(r["bounced"], {"role": "hermes-architect", "session_id": "s-a14", "status": "completed", "changed": ago(2.0), "repeat": True,
                                        "after_rearm_for": None, "bounces_24h": 2, "last_bounce_at": ago(1.0), "source": "host-log"})
        self.assertEqual([(a["kind"], a["alert_kind"], a["alert_key"]) for a in out["actions"]], [("alert", "bounce-repeat", "bounce-repeat:dispatched")])
        self.assertIn(f"hermes-architect session s-a14 bounced 2× in 24h (host re-armed it each time, last {ago(1.0)}; newest ack completed at {ago(2.0)}); "
                      "no re-arm from the supervisor", r["alert_line"])
        self.assertIn(f"decision: check the host error log around {ago(1.0)} for the provider/proxy error; if it bounces again, spawn a fresh hermes-architect session by hand",
                      r["alert_line"])
        self.assertEqual((out["summary"]["bounced"], out["summary"]["escalate"], out["summary"]["must_nudge"]), (1, 1, 0))
        # once: the same 24 h key as the ack-based repeat
        quiet = run(self.st, self.threads, sessions=self.sessions, acks=self.hist("completed", 2.0, 2), nudges={"ISO-F14": {"alerts": {"bounce-repeat:dispatched": ago(0.5)}}})
        self.assertEqual(quiet["actions"], [])
        self.assertEqual(quiet["rows"]["ISO-F14"]["bounced"]["repeat"], True)  # still reported on the row
        # a `processing` ack (the redrive is running now) with 3 behind it: the alert, and no timestamp is invented
        proc = run(self.st, self.threads, sessions=self.sessions, acks=self.hist("processing", 0.2, 3, last_h=None))
        self.assertEqual([a["alert_kind"] for a in proc["actions"]], ["bounce-repeat"])
        self.assertIn("bounced 3× in 24h (host re-armed it each time, last time unknown (see collect-acks bounce_log)", proc["rows"]["ISO-F14"]["alert_line"])
        # the ordinary checks still run beside it: a 7 h old dispatch also draws its SLO nudge
        st7, base7 = dispatched_row("ISO-F14", 7)
        both = run(st7, {"hermes-ISO-F14": base7}, sessions=self.sessions, acks=self.hist("completed", 2.0, 2))
        self.assertEqual([(a["kind"], a.get("target_role"), a.get("alert_kind")) for a in both["actions"]], [("nudge", "hermes-architect", None), ("alert", None, "bounce-repeat")])
        self.assertEqual(both["rows"]["ISO-F14"]["slo_status"], "breached")

    def test_one_host_rearm_or_no_field_is_nothing(self):
        one = run(self.st, self.threads, sessions=self.sessions, acks=self.hist("completed", 2.0, 1))
        self.assertEqual((one["actions"], one["rows"]["ISO-F14"]["bounced"], one["summary"]["bounced"]), ([], None, 0))
        plain = run(self.st, self.threads, sessions=self.sessions, acks=acks(("s-a14", "completed", 2.0, "hermes-architect", "hermes-ISO-F14")))
        self.assertEqual((plain["actions"], plain["rows"]["ISO-F14"]["bounced"]), ([], None))
        # a count that is not an int is not a count (never guess); another role's or thread's history is not this row's
        for bad in ("2", 2.0, True, None, -1):
            with self.subTest(bad=bad):
                out = run(self.st, self.threads, sessions=self.sessions, acks=self.hist("completed", 2.0, bad))
                self.assertEqual((out["actions"], out["rows"]["ISO-F14"]["bounced"]), ([], None))
        other = acks(("s-b14", "completed", 1.0, "hermes-builder", "hermes-ISO-F14", {"bounces_24h": 5}),
                     ("s-a13", "completed", 1.0, "hermes-architect", "hermes-ISO-F13", {"bounces_24h": 5}))
        out = run(self.st, self.threads, sessions=self.sessions, acks=other)
        self.assertEqual((out["actions"], out["rows"]["ISO-F14"]["bounced"]), ([], None))
        # stale acks: off, as for every ack-based check
        stale = self.hist("completed", 2.0, 3)
        stale["generated_at"] = ago(3.0)
        out = run(self.st, self.threads, sessions=self.sessions, acks=stale)
        self.assertEqual((out["actions"], out["acks"]["status"]), ([], "stale"))

    def test_ack_less_session_with_host_rearms_is_a_repeat_too(self):
        """A first-turn session whose only ack row was the bounced one the sweep deleted: collect-acks.sh writes an
        ack-less entry (status / changed null, ack_empty) carrying the log's count. role_ack reads no current ack from
        it; the repeat alert still fires, and no timestamp or status is invented in its text."""
        entry = {"status": None, "changed": None, "message_id": None, "ack_empty": True, "role": "hermes-architect", "thread_id": "hermes-ISO-F14",
                 "thread_id_raw": "hermes-ISO-F14", "container_status": "stopped", "bounces_24h": 3, "last_bounce_at": ago(0.3)}
        ak = {"generated_at": ago(0.1), "sessions": {"s-a14": entry}}
        self.assertIsNone(hs.role_ack(ak["sessions"], "hermes-ISO-F14", "hermes-architect"))
        out = run(self.st, self.threads, sessions=self.sessions, acks=ak)
        r = out["rows"]["ISO-F14"]
        self.assertEqual((r["bounced"]["bounces_24h"], r["bounced"]["status"], r["bounced"]["changed"], r["bounced"]["source"]), (3, "", None, "host-log"))
        self.assertEqual([a["alert_kind"] for a in out["actions"]], ["bounce-repeat"])
        self.assertIn(f"bounced 3× in 24h (host re-armed it each time, last {ago(0.3)}; newest ack none — no processing_ack row, "
                      "the sweep deleted the bounced claim at ?)", r["alert_line"])
        self.assertIsNone(r["idle_turn"])
        # one re-arm behind it: nothing, as for any session
        one = {"generated_at": ago(0.1), "sessions": {"s-a14": dict(entry, bounces_24h=1)}}
        self.assertEqual(run(self.st, self.threads, sessions=self.sessions, acks=one)["actions"], [])

    def test_current_bounce_with_two_host_rearms_is_a_repeat_not_a_rearm(self):
        out = run(self.st, self.threads, sessions=self.sessions, acks=self.hist("bounced-transient", 3.0, 2, last_h=3.2))
        r = out["rows"]["ISO-F14"]
        self.assertEqual((r["bounced"]["repeat"], r["bounced"]["after_rearm_for"], r["bounced"]["bounces_24h"], r["bounced"]["last_bounce_at"]), (True, None, 2, ago(3.2)))
        self.assertEqual([a["kind"] for a in out["actions"]], ["alert"])
        self.assertIn(f"after 2 host re-arms of session s-a14 in 24h (last {ago(3.2)}); no re-arm from the supervisor", r["alert_line"])
        self.assertIn(f"decision: the provider outage (bounced-transient) is still on: check the host error log around {ago(3.0)}", r["alert_line"])
        self.assertEqual((r["slo_status"], r["alert_kind"]), ("escalated", "bounce-repeat"))
        # one host re-arm behind it: the ordinary first re-arm, the count reported on the row
        one = run(self.st, self.threads, sessions=self.sessions, acks=self.hist("bounced-transient", 3.0, 1))
        n = next(a for a in one["actions"] if a["kind"] == "nudge")
        self.assertEqual((n["check"], n["rearm_session_id"], n["rearm_thread_id"], n["thread_id"]), ("bounced", "s-a14", "hermes-ISO-F14", "hermes-ISO-F14"))
        self.assertNotIn("row_thread_id", n)
        self.assertEqual((one["rows"]["ISO-F14"]["bounced"]["bounces_24h"], one["rows"]["ISO-F14"]["bounced"]["repeat"]), (1, False))


class ThreadCase(unittest.TestCase):
    """ISO-F13, 2026-09-16: the builder addressed tester and reviewer with thread `hermes-iso-f13`; NanoClaw keyed
    their sessions on that string. The collectors now attribute such sessions to the row (canonical thread) and keep
    the real thread as `thread_id_raw`; the supervisor alerts once per (row, raw thread) and sends every pinned nudge /
    re-arm into the thread the session really lives on."""

    def setUp(self):
        self.st, base = dispatched_row("ISO-F13", 4)
        self.threads = {"hermes-ISO-F13": base + [msg(3.5, "ISO-F13 research done — spec next", sender="hermes-architect")]}
        self.canon = {"role": "hermes-architect", "session_id": "s-a13", "cost_status": "ok", "container_status": "stopped", "status": "active", "thread_id_raw": "hermes-ISO-F13"}
        self.stray = {"role": "hermes-tester", "session_id": "s-t13", "cost_status": "ok", "container_status": "stopped", "status": "active", "thread_id_raw": "hermes-iso-f13"}
        self.orch = {"role": "orchestrator", "session_id": "s-o13", "cost_status": "ok", "container_status": "stopped", "status": "active"}

    def test_alert_once_per_row_and_raw_thread_beside_the_ordinary_action(self):
        sessions = {"hermes-ISO-F13": [self.canon, self.stray, self.orch]}
        out = run(self.st, self.threads, sessions=sessions)
        r = out["rows"]["ISO-F13"]
        self.assertEqual(r["thread_case"], [{"thread_id_raw": "hermes-iso-f13", "roles": ["hermes-tester"], "session_ids": ["s-t13"]}])
        self.assertEqual([(a["kind"], a["alert_kind"], a["alert_key"], a["thread_id"]) for a in out["actions"]],
                         [("alert", "thread-case", "thread-case:hermes-iso-f13", "hermes-status")])
        line = out["actions"][0]["text"]
        self.assertIn("ISO-F13 · hermes-iso-f13 4h · hermes-tester opened session(s) s-t13 on mis-cased thread hermes-iso-f13 (row thread hermes-ISO-F13)", line)
        self.assertIn("decision: have the sender address hermes-ISO-F13 exactly", line)
        # informational: the row's own state and action are untouched (4 h dispatched: nothing due)
        self.assertEqual((r["stage"], r["action"], r["slo_status"], r["alert_kind"]), ("dispatched", "none", "ok", None))
        self.assertEqual((out["summary"]["thread_case"], out["summary"]["escalate"]), (1, 1))
        # 24 h bound per (row, raw thread)
        quiet = run(self.st, self.threads, sessions=sessions, nudges={"ISO-F13": {"alerts": {"thread-case:hermes-iso-f13": ago(2.0)}}})
        self.assertEqual(quiet["actions"], [])
        self.assertEqual(quiet["rows"]["ISO-F13"]["thread_case"][0]["thread_id_raw"], "hermes-iso-f13")  # still on the row
        # a second stray spelling is a second alert; the same one from the acks adds its role, not a duplicate
        rev = dict(self.stray, role="hermes-reviewer", session_id="s-r13", thread_id_raw="hermes-Iso-F13")
        ak = acks(("s-t13", "completed", 1.0, "hermes-tester", "hermes-ISO-F13", {"thread_id_raw": "hermes-iso-f13"}),
                  ("s-b13", "completed", 1.0, "hermes-builder", "hermes-ISO-F13", {"thread_id_raw": "hermes-iso-f13"}))
        two = run(self.st, self.threads, sessions={"hermes-ISO-F13": [self.canon, self.stray, rev, self.orch]}, acks=ak)
        self.assertEqual(two["rows"]["ISO-F13"]["thread_case"], [
            {"thread_id_raw": "hermes-Iso-F13", "roles": ["hermes-reviewer"], "session_ids": ["s-r13"]},
            {"thread_id_raw": "hermes-iso-f13", "roles": ["hermes-tester", "hermes-builder"], "session_ids": ["s-t13", "s-b13"]},
        ])
        self.assertEqual(sorted(a["alert_key"] for a in two["actions"]), ["thread-case:hermes-Iso-F13", "thread-case:hermes-iso-f13"])
        # acks alone (no sessions file) are evidence too; canonical threads everywhere draw nothing
        only_acks = run(self.st, self.threads, acks=ak)
        self.assertEqual([a["alert_key"] for a in only_acks["actions"]], ["thread-case:hermes-iso-f13"])
        none = run(self.st, self.threads, sessions={"hermes-ISO-F13": [self.canon, self.orch]})
        self.assertEqual((none["actions"], none["rows"]["ISO-F13"]["thread_case"], none["summary"]["thread_case"]), ([], None, 0))
        # a paused row is silent, as for every other action
        paused = run(self.st, self.threads, sessions=sessions, config={"paused_rows": ["ISO-F13"]})
        self.assertEqual([a["kind"] for a in paused["actions"]], ["hold"])

    def test_pinned_nudges_and_rearms_carry_the_sessions_real_thread(self):
        # the ARCHITECT itself sits on the mis-cased thread: its SLO nudge is pinned to that session and names that thread
        arch = dict(self.canon, thread_id_raw="hermes-iso-f13")
        st7, base7 = dispatched_row("ISO-F13", 7)
        out = run(st7, {"hermes-ISO-F13": base7}, sessions={"hermes-ISO-F13": [arch, self.orch]})
        n = next(a for a in out["actions"] if a["kind"] == "nudge")
        self.assertEqual((n["target_role"], n["target_session_id"], n["thread_id"], n["row_thread_id"]), ("hermes-architect", "s-a13", "hermes-iso-f13", "hermes-ISO-F13"))
        self.assertIn("it lives on mis-cased thread hermes-iso-f13: thread_id carries that thread", n["target_session_note"])
        self.assertTrue(n["text"].startswith("Supervisor nudge ISO-F13:"), n["text"])
        self.assertEqual([a["alert_key"] for a in out["actions"] if a["kind"] == "alert"], ["thread-case:hermes-iso-f13"])
        # a bounce of that session: the re-arm is addressed to the Orchestrator's row session, but the send it asks for
        # goes into the REAL thread, pinned to the REAL session — the texts name it, the action's thread_id carries it
        ak = acks(("s-a13", "bounced-transient", 3.0, "hermes-architect", "hermes-ISO-F13", {"thread_id_raw": "hermes-iso-f13"}))
        b = run(self.st, self.threads, sessions={"hermes-ISO-F13": [arch, self.orch]}, acks=ak)
        n = next(a for a in b["actions"] if a["kind"] == "nudge")
        self.assertEqual((n["check"], n["target_role"], n["target_session_id"]), ("bounced", "orchestrator", "s-o13"))
        self.assertEqual((n["rearm_role"], n["rearm_session_id"], n["rearm_thread_id"], n["thread_id"], n["row_thread_id"]),
                         ("hermes-architect", "s-a13", "hermes-iso-f13", "hermes-iso-f13", "hermes-ISO-F13"))
        self.assertIn("re-arm hermes-architect on hermes-iso-f13:", n["text"])
        self.assertIn("with no output on thread hermes-iso-f13.", n["rearm_text"])
        self.assertEqual(b["rows"]["ISO-F13"]["bounced"]["thread_id_raw"], "hermes-iso-f13")
        self.assertIn("; hermes-architect's session lives on mis-cased thread hermes-iso-f13: send the re-arm there", n["target_session_note"])
        # the ack alone knows the raw thread (no sessions file): the re-arm still carries it
        b2 = run(self.st, self.threads, acks=ak)
        n2 = next(a for a in b2["actions"] if a["kind"] == "nudge")
        self.assertEqual((n2["rearm_thread_id"], n2["thread_id"], n2["target_session_id"]), ("hermes-iso-f13", "hermes-iso-f13", None))
        # an infra-hold re-arm pins the hold role's session and its real thread the same way
        hold_threads = {"hermes-ISO-F13": self.threads["hermes-ISO-F13"] + [msg(3, "HOLD on ISO-F13 — codex is down, parking", sender="hermes-architect")]}
        h = run(self.st, hold_threads, sessions={"hermes-ISO-F13": [arch, self.orch]})
        n3 = next(a for a in h["actions"] if a["kind"] == "nudge")
        self.assertEqual((n3["check"], n3["rearm_session_id"], n3["rearm_thread_id"], n3["thread_id"]), ("infra_hold", "s-a13", "hermes-iso-f13", "hermes-iso-f13"))
        # a canonical session: thread_id is the row thread and no row_thread_id is added (the pre-incident shape)
        c = run(st7, {"hermes-ISO-F13": base7}, sessions={"hermes-ISO-F13": [self.canon, self.orch]})
        n4 = next(a for a in c["actions"] if a["kind"] == "nudge")
        self.assertEqual(n4["thread_id"], "hermes-ISO-F13")
        self.assertNotIn("row_thread_id", n4)


    def test_inferred_or_unrelated_thread_is_not_a_thread_case_and_never_reroutes(self):
        """collect_threads pass 2 attaches a role's session that only MENTIONS the row: it lives on a DM / `hermes-P0-LOOP`,
        which is not a spelling of the row thread. No thread-case alert, and the row's nudge stays pinned to it on the
        CANONICAL thread — re-routing would spawn the role in that unrelated thread once the host rejected the pin."""
        st7, base7 = dispatched_row("ISO-F13", 7)
        inferred = dict(self.canon, inferred=True, thread_id_raw="hermes-P0-LOOP")
        out = run(st7, {"hermes-ISO-F13": base7}, sessions={"hermes-ISO-F13": [inferred, self.orch]})
        self.assertEqual([a["kind"] for a in out["actions"]], ["nudge"])
        n = out["actions"][0]
        self.assertEqual((n["target_role"], n["target_session_id"], n["thread_id"]), ("hermes-architect", "s-a13", "hermes-ISO-F13"))
        self.assertNotIn("row_thread_id", n)
        self.assertNotIn("mis-cased", n["target_session_note"])
        self.assertEqual((out["rows"]["ISO-F13"]["thread_case"], out["summary"]["thread_case"]), (None, 0))
        # a non-inferred record whose thread_id_raw is some OTHER thread (an older mirror's stray value): not a spelling either
        stray = dict(self.canon, thread_id_raw="hermes-P0-LOOP")
        out2 = run(st7, {"hermes-ISO-F13": base7}, sessions={"hermes-ISO-F13": [stray, self.orch]})
        self.assertEqual([(a["kind"], a["thread_id"]) for a in out2["actions"]], [("nudge", "hermes-ISO-F13")])
        self.assertIsNone(out2["rows"]["ISO-F13"]["thread_case"])
        # a bounce of the inferred pinned session: the re-arm goes to the canonical thread too
        ak = acks(("s-a13", "bounced-transient", 3.0, "hermes-architect", "hermes-ISO-F13"))
        b = run(self.st, self.threads, sessions={"hermes-ISO-F13": [inferred, self.orch]}, acks=ak)
        n = next(a for a in b["actions"] if a["kind"] == "nudge")
        self.assertEqual((n["check"], n["rearm_session_id"], n["rearm_thread_id"], n["thread_id"]), ("bounced", "s-a13", "hermes-ISO-F13", "hermes-ISO-F13"))
        self.assertNotIn("row_thread_id", n)
        # the rule itself: a variant differs in case only
        self.assertEqual(hs._variant_thread("hermes-iso-f13", "hermes-ISO-F13"), "hermes-iso-f13")
        self.assertEqual(hs._variant_thread("hermes-Iso-F13", "hermes-ISO-F13"), "hermes-Iso-F13")
        for not_variant in ("hermes-ISO-F13", "hermes-P0-LOOP", "hermes-ISO-F14", "hermes-status", "", None, 7):
            self.assertIsNone(hs._variant_thread(not_variant, "hermes-ISO-F13"), not_variant)

    def test_malformed_acks_entries_do_not_kill_the_tick(self):
        """acks_status validates the `sessions` map, not each entry: a None / str / int / list value beside a good one must
        not raise in the thread-case scan, which runs for every in-flight row on every tick."""
        good = acks(("s-t13", "completed", 1.0, "hermes-tester", "hermes-ISO-F13", {"thread_id_raw": "hermes-iso-f13"}))
        for bad in (None, "garbage", 7, ["list"]):
            with self.subTest(bad=bad):
                ak = json.loads(json.dumps(good))
                ak["sessions"]["s-bad"] = bad
                out = run(self.st, self.threads, sessions={"hermes-ISO-F13": [self.canon, self.orch]}, acks=ak)
                self.assertEqual(out["rows"]["ISO-F13"]["thread_case"], [{"thread_id_raw": "hermes-iso-f13", "roles": ["hermes-tester"], "session_ids": ["s-t13"]}])
                self.assertEqual([a["alert_key"] for a in out["actions"]], ["thread-case:hermes-iso-f13"])

    def test_acks_raw_thread_wins_over_a_sessions_record_without_the_field(self):
        """A sessions-by-thread.json from a pull-state.sh mirror that predates thread_id_raw, beside an acks.json that
        carries it: the re-arm is addressed to the thread the host says the session lives on, not the canonical one."""
        old = {k: v for k, v in self.canon.items() if k != "thread_id_raw"}
        ak = acks(("s-a13", "bounced-transient", 3.0, "hermes-architect", "hermes-ISO-F13", {"thread_id_raw": "hermes-iso-f13"}))
        out = run(self.st, self.threads, sessions={"hermes-ISO-F13": [old, self.orch]}, acks=ak)
        n = next(a for a in out["actions"] if a["kind"] == "nudge")
        self.assertEqual((n["rearm_session_id"], n["rearm_thread_id"], n["thread_id"], n["row_thread_id"]), ("s-a13", "hermes-iso-f13", "hermes-iso-f13", "hermes-ISO-F13"))
        rec = {"thread_id": "hermes-ISO-F13"}
        self.assertEqual(hs._Tick(NOW_DT, sessions={"hermes-ISO-F13": [old]}, acks=ak).session_thread(rec, "hermes-architect", "s-a13"), "hermes-iso-f13")
        # a record that does carry the field is read as written (fresher than the 15-min acks file)
        self.assertEqual(hs._Tick(NOW_DT, sessions={"hermes-ISO-F13": [self.canon]}, acks=ak).session_thread(rec, "hermes-architect", "s-a13"), "hermes-ISO-F13")
        # neither knows the session: the canonical thread
        self.assertEqual(hs._Tick(NOW_DT, sessions={}, acks=None).session_thread(rec, "hermes-architect", "s-zzz"), "hermes-ISO-F13")


class IdleTurn(unittest.TestCase):
    """ISO-F13, 2026-09-15: the architect's turn ended right after "research done" with no [Spec handoff];
    the container was gone; the row read as progressing for the whole 6 h SLO."""

    def setUp(self):
        self.st, base = dispatched_row("ISO-F13", 4)
        self.threads = {"hermes-ISO-F13": base + [msg(3.6, "ISO-F13 research done — writing the ADR next", sender="hermes-architect")]}
        self.done = ("s-a13", "completed", 3.5, "hermes-architect", "hermes-ISO-F13")

    @staticmethod
    def sessions(container: str) -> dict:
        return {"hermes-ISO-F13": [{"role": "hermes-architect", "session_id": "s-a13", "cost_status": "ok", "container_status": container, "status": "active"}]}

    def test_completed_turn_stopped_container_no_marker_nudges_early_once(self):
        out = run(self.st, self.threads, sessions=self.sessions("stopped"), acks=acks(self.done))
        r = out["rows"]["ISO-F13"]
        self.assertFalse(r["slo_breach"])  # 4 h < 6 h: the ordinary nudge would wait two more hours
        self.assertEqual(r["idle_turn"], {"role": "hermes-architect", "session_id": "s-a13", "ended": ago(3.5), "age_hours": 3.5, "container_status": "stopped"})
        self.assertEqual((r["action"], r["target_role"], r["slo_status"]), ("nudge", "hermes-architect", "idle-turn"))
        n = out["actions"][0]
        self.assertEqual((n["kind"], n["check"], n["target_role"], n["target_session_id"], n["turn_ended"], n["marker"]), ("nudge", "idle_turn", "hermes-architect", "s-a13", ago(3.5), "[Spec handoff]"))
        self.assertTrue(n["text"].startswith("Supervisor nudge ISO-F13: dispatched for 4h, no [Spec handoff]. Expected next: [Spec handoff]"), n["text"])
        self.assertTrue(n["text"].endswith(f"Your turn at {ago(3.5)} ended without the [Spec handoff]; if the work is done, send the marker now."), n["text"])
        self.assertEqual((out["summary"]["idle_turn"], out["summary"]["must_nudge"]), (1, 1))
        # once per T: the recorded text bounds it (and, being a "Supervisor nudge", so does the 6 h row bound once it is on the thread)
        booked = run(self.st, self.threads, sessions=self.sessions("stopped"), acks=acks(self.done), nudges={"ISO-F13": {"texts": [n["text"]]}})
        self.assertEqual(booked["actions"], [])
        self.assertIn(f"idle-turn nudge already sent for the turn at {ago(3.5)}", booked["rows"]["ISO-F13"]["reason"])
        on_thread = run(self.st, {"hermes-ISO-F13": self.threads["hermes-ISO-F13"] + [msg(0.5, n["text"], "in", sender="orchestrator")]}, sessions=self.sessions("stopped"), acks=acks(self.done))
        self.assertEqual(on_thread["actions"], [])
        self.assertEqual(on_thread["rows"]["ISO-F13"]["nudges"]["count"], 1)

    def test_running_container_unknown_status_young_turn_or_marker_after_turn_is_not_idle(self):
        r = run(self.st, self.threads, sessions=self.sessions("running"), acks=acks(self.done))["rows"]["ISO-F13"]
        self.assertEqual((r["idle_turn"], r["action"]), (None, "none"))
        # unknown container status: no signal (never guess) ...
        self.assertIsNone(run(self.st, self.threads, sessions={}, acks=acks(self.done))["rows"]["ISO-F13"]["idle_turn"])
        # ... unless the ack itself carries it
        with_cs = acks(("s-a13", "completed", 3.5, "hermes-architect", "hermes-ISO-F13", {"container_status": "stopped"}))
        self.assertIsNotNone(run(self.st, self.threads, sessions={}, acks=with_cs)["rows"]["ISO-F13"]["idle_turn"])
        # younger than half the 6 h SLO
        young = acks(("s-a13", "completed", 2.0, "hermes-architect", "hermes-ISO-F13"))
        self.assertIsNone(run(self.st, self.threads, sessions=self.sessions("stopped"), acks=young)["rows"]["ISO-F13"]["idle_turn"])
        # a turn that predates the stage clock: the role has not taken its turn yet, the SLO applies
        st = state([{"id": "ISO-F13", "spec": stamp(1)}])
        old_turn = acks(("s-a13", "completed", 3.0, "hermes-architect", "hermes-ISO-F13"))
        r = run(st, {"hermes-ISO-F13": [spec_handoff("ISO-F13", 1)]}, sessions=self.sessions("stopped"), acks=old_turn)["rows"]["ISO-F13"]
        self.assertEqual((r["stage"], r["idle_turn"], r["action"]), ("spec_handoff", None, "none"))

    def test_a_turn_that_ended_with_a_blocker_or_hold_is_not_idle(self):
        # The `completed` ack is stamped AFTER the turn's outputs, so the turn's own [Blocker] is always BEFORE T
        # (poll-loop markCompleted runs once processQuery returns). It is the alternative artifact the nudge names.
        base = self.threads["hermes-ISO-F13"]
        blocker = msg(3.55, "[Blocker] ISO-F13: the credential fixture is missing", sender="hermes-architect")
        out = run(self.st, {"hermes-ISO-F13": base + [blocker]}, sessions=self.sessions("stopped"), acks=acks(self.done))
        self.assertEqual((out["rows"]["ISO-F13"]["idle_turn"], out["rows"]["ISO-F13"]["blocker_open"], out["actions"]), (None, True, []))
        # a hold as the turn's last line: same (and the hold path owns the row: infra-hold alert + re-arm, no idle nudge)
        held = run(self.st, {"hermes-ISO-F13": base + [msg(3.55, HOLD_BUILDER, sender="hermes-architect")]}, sessions=self.sessions("stopped"), acks=acks(self.done))
        self.assertIsNone(held["rows"]["ISO-F13"]["idle_turn"])
        self.assertEqual([a.get("check") for a in held["actions"] if a["kind"] == "nudge"], ["infra_hold"])
        # the blocker followed by chatter in the SAME turn (turn start = the role's newest inbound before T): still not idle
        dispatch = msg(4, "Dispatch ISO-F13: title.", "in", role="hermes-architect")
        same_turn = [dispatch, msg(3.8, "[Blocker] ISO-F13: fixture missing", sender="hermes-architect", role="hermes-architect"),
                     msg(3.6, "waiting for the fixture; parking", sender="hermes-architect", role="hermes-architect")]
        self.assertIsNone(run(self.st, {"hermes-ISO-F13": same_turn}, sessions=self.sessions("stopped"), acks=acks(self.done))["rows"]["ISO-F13"]["idle_turn"])
        # a blocker from a PREVIOUS turn (an operator addendum started a new one) does not excuse this turn's silence
        new_turn = [dispatch, msg(3.8, "[Blocker] ISO-F13: fixture missing", sender="hermes-architect", role="hermes-architect"),
                    msg(3.7, "addendum: the fixture is at /shared/fixtures; proceed", "in", role="hermes-architect"),
                    msg(3.6, "ISO-F13 research done — writing the ADR next", sender="hermes-architect", role="hermes-architect")]
        r = run(self.st, {"hermes-ISO-F13": new_turn}, sessions=self.sessions("stopped"), acks=acks(self.done))["rows"]["ISO-F13"]
        self.assertEqual((r["idle_turn"]["ended"], r["action"]), (ago(3.5), "nudge"))

    def test_half_slo_floor_is_one_hour_and_the_slo_nudge_takes_precedence(self):
        # spec_handoff nudges after 2 h -> the early nudge at 1 h
        st = state([{"id": "ISO-F13", "spec": stamp(1.5)}])
        threads = {"hermes-ISO-F13": [spec_handoff("ISO-F13", 1.5)]}
        r = run(st, threads, sessions=self.sessions("stopped"), acks=acks(("s-a13", "completed", 1.2, "hermes-architect", "hermes-ISO-F13")))["rows"]["ISO-F13"]
        self.assertEqual((r["stage"], r["action"], r["idle_turn"]["age_hours"]), ("spec_handoff", "nudge", 1.2))
        self.assertIn("no forward to hermes-builder", r["message"])
        # past the ordinary SLO the regular nudge fires alone: never two nudges for one row in one tick
        st2, base2 = dispatched_row("ISO-F13", 7)
        out = run(st2, {"hermes-ISO-F13": base2}, sessions=self.sessions("stopped"), acks=acks(("s-a13", "completed", 6.5, "hermes-architect", "hermes-ISO-F13")))
        nudges = [a for a in out["actions"] if a["kind"] == "nudge"]
        self.assertEqual(len(nudges), 1)
        self.assertNotIn("check", nudges[0])
        self.assertIsNotNone(out["rows"]["ISO-F13"]["idle_turn"])  # still on the status table
        # an SLO nudge already sent in this state: no early nudge on top of it
        out2 = run(self.st, self.threads, sessions=self.sessions("stopped"), acks=acks(self.done), nudges={"ISO-F13": {"last_nudge": ago(6.5), "state": "dispatched", "count": 1}})
        self.assertEqual(out2["actions"], [])
        # inside the 6 h row bound (a nudge 2 h ago, other state): no early nudge either
        out3 = run(self.st, self.threads, sessions=self.sessions("stopped"), acks=acks(self.done), nudges={"ISO-F13": {"last_nudge": ago(2), "state": "queued", "count": 1}})
        self.assertEqual(out3["actions"], [])
        self.assertIsNotNone(out3["rows"]["ISO-F13"]["idle_turn"])


class AcksOff(unittest.TestCase):
    """No acks.json, a malformed one, or one older than 2 h: both ack-based detections are off, nothing
    crashes, and the output says so (`acks.status`, `summary.acks`)."""

    def setUp(self):
        self.st, base = dispatched_row("ISO-F14", 4)
        self.threads = {"hermes-ISO-F14": base}
        self.sessions = {"hermes-ISO-F14": [{"role": "hermes-architect", "session_id": "s-a14", "cost_status": "ok", "container_status": "stopped", "status": "active"}]}
        self.bounce = ("s-a14", "bounced-transient", 3.0, "hermes-architect", "hermes-ISO-F14")

    def test_missing_stale_or_malformed_acks_switch_both_detections_off(self):
        cases = [
            ("missing", None), ("missing", {}), ("missing", {"sessions": "nope"}), ("missing", {"generated_at": "garbage", "sessions": {}}),
            ("missing", {"sessions": acks(self.bounce)["sessions"]}),  # no generated_at: age unknown, so off
            ("stale", acks(self.bounce, generated_h=2.5)),
        ]
        for label, ak in cases:
            out = run(self.st, self.threads, sessions=self.sessions, acks=ak)
            self.assertEqual(out["acks"]["status"], label, ak)
            self.assertEqual(out["acks"]["note"], ACKS_OFF)
            self.assertEqual(out["summary"]["acks"], label)
            self.assertEqual((out["summary"]["bounced"], out["summary"]["idle_turn"]), (0, 0))
            self.assertIsNone(out["rows"]["ISO-F14"]["bounced"])
            self.assertIsNone(out["rows"]["ISO-F14"]["idle_turn"])
            self.assertEqual(out["actions"], [])
        stale = run(self.st, self.threads, sessions=self.sessions, acks=acks(self.bounce, generated_h=2.5))["acks"]
        self.assertEqual((stale["age_hours"], stale["sessions"], stale["generated_at"]), (2.5, 1, ago(2.5)))
        fresh = run(self.st, self.threads, sessions=self.sessions, acks=acks(self.bounce, generated_h=1.9))
        self.assertEqual((fresh["acks"]["status"], fresh["acks"]["note"], fresh["acks"]["sessions"], fresh["summary"]["bounced"]), ("ok", None, 1, 1))
        # the infra-hold detection reads the thread, not acks: it stays on regardless
        held = run(self.st, {"hermes-ISO-F14": self.threads["hermes-ISO-F14"] + [msg(1, HOLD_BUILDER, sender="hermes-builder")]}, acks=None)
        self.assertEqual(held["rows"]["ISO-F14"]["alert_kind"], "infra-hold")

    def test_cli_accepts_acks_and_reports_a_missing_file(self):
        with tempfile.TemporaryDirectory() as d:
            paths = {}
            for name, obj in (("state", self.st), ("threads", self.threads), ("prs", []), ("nudges", {}), ("acks", acks(self.bounce))):
                paths[name] = Path(d) / f"{name}.json"
                paths[name].write_text(json.dumps(obj))
            argv = [sys.executable, str(HERE / "hermes_supervise.py"), "--state", str(paths["state"]), "--threads", str(paths["threads"]),
                    "--prs", str(paths["prs"]), "--nudges", str(paths["nudges"]), "--now", NOW, "--json"]
            with_acks = json.loads(subprocess.run(argv + ["--acks", str(paths["acks"])], capture_output=True, text=True, check=False).stdout)
            self.assertEqual((with_acks["acks"]["status"], with_acks["summary"]["bounced"]), ("ok", 1))
            absent = json.loads(subprocess.run(argv + ["--acks", str(Path(d) / "absent.json")], capture_output=True, text=True, check=False).stdout)
            self.assertEqual((absent["acks"]["status"], absent["summary"]["bounced"]), ("missing", 0))
            p = subprocess.run([sys.executable, str(HERE / "hermes_supervise.py"), "--help"], capture_output=True, text=True, check=False)
            self.assertIn("--acks", p.stdout)


@unittest.skipUnless(shutil.which("bash"), "bash not available")
class CollectAcksScript(unittest.TestCase):
    """collect-acks.sh, the host-side acks.json writer, run offline: a fake `hostname` on PATH and the two probe
    outputs (q.ts rows, bun probe JSON) recorded as fixtures. Pins the hostname guard, the hermes-<ROW> filter,
    the JSON shape hermes_supervise --acks reads, the atomic write, and "no source -> nothing written"."""

    SCRIPT = HERE / "collect-acks.sh"

    def run_script(self, tmp: str, hostname: str = "slang-cpu-coworkers", **env_extra: str) -> subprocess.CompletedProcess:
        b = Path(tmp) / "bin"
        b.mkdir(exist_ok=True)
        (b / "hostname").write_text("#!/usr/bin/env bash\necho \"${FAKE_HOSTNAME:-" + hostname + "}\"\n")
        os.chmod(b / "hostname", 0o755)
        env = {**os.environ, "PATH": f"{b}:{os.environ.get('PATH', '')}", "ROOT": tmp, "NOW_OVERRIDE": NOW, **env_extra}
        return subprocess.run(["bash", str(self.SCRIPT)], capture_output=True, text=True, env=env, check=False)

    def test_syntax(self):
        p = subprocess.run(["bash", "-n", str(self.SCRIPT)], capture_output=True, text=True, check=False)
        self.assertEqual(p.returncode, 0, p.stderr)

    def test_refuses_to_run_off_the_box(self):
        with tempfile.TemporaryDirectory() as d:
            p = self.run_script(d, hostname="harshs-mac")
            self.assertEqual(p.returncode, 9)
            self.assertIn("WRONG_HOST=harshs-mac", p.stdout)
            self.assertFalse((Path(d) / "data").exists())

    def test_json_shape_from_recorded_probes(self):
        with tempfile.TemporaryDirectory() as d:
            tsv = Path(d) / "sessions.tsv"
            # id|folder|name|thread_id|container_status|status|agent_group_id — what the q.ts select (or the ncl fallback) emits
            tsv.write_text(
                "s-a14|hermes-architect|Hermes Architect|hermes-ISO-F14|stopped|active|ag-arch\n"
                "s-o14|orchestrator|Orchestrator|hermes-ISO-F14|running|active|ag-orch\n"
                "s-t13|hermes-tester|hermes-tester|hermes-ISO-F13|stopped|active|ag-test\n"
                "s-b58|hermes-builder|Builder|hermes-OPS-F58.a|stopped|active|ag-build\n"
                "s-r21|hermes-reviewer-v2|hermes-reviewer|hermes-A2A-F21|stopped|active|ag-rev2\n"  # folder is not a role, NAME is
                "s-z21|hermes-scribe|Scribe|hermes-A2A-F21|stopped|active|ag-scribe\n"  # neither is: flagged, never a silent miss
                "s-r13|hermes-reviewer|hermes-reviewer|hermes-iso-f13|stopped|active|ag-rev\n"  # the 2026-09-16 mis-cased thread: attributed to ISO-F13
                "s-x|orchestrator|Orchestrator|hermes-status|stopped|active|ag-orch\n"  # not a matrix row
                "s-y|hermes-builder|Builder|hermes-P0-LOOP|stopped|active|ag-build\n"  # not a matrix row
            )
            probe = Path(d) / "probe.json"
            probe.write_text(json.dumps([
                {"path": f"{d}/data/v2-sessions/ag-arch/s-a14/outbound.db", "message_id": "m1", "status": "bounced-transient", "changed": "2026-09-15T17:00:00.123Z"},
                {"path": f"{d}/data/v2-sessions/ag-orch/s-o14/outbound.db", "message_id": "m2", "status": "completed", "changed": "2026-09-15T18:00:00.000Z"},
                {"path": f"{d}/data/v2-sessions/ag-test/s-t13/outbound.db", "error": "SQLiteError: database is locked"},
                {"path": f"{d}/data/v2-sessions/ag-build/s-b58/outbound.db", "empty": True},
                {"path": f"{d}/data/v2-sessions/ag-rev2/s-r21/outbound.db", "message_id": "m4", "status": "completed", "changed": "2026-09-15T18:30:00Z"},
                {"path": f"{d}/data/v2-sessions/ag-scribe/s-z21/outbound.db", "message_id": "m5", "status": "completed", "changed": "2026-09-15T18:30:00Z"},
                {"path": f"{d}/data/v2-sessions/ag-rev/s-r13/outbound.db", "message_id": "m6", "status": "completed", "changed": "2026-09-15T18:40:00Z"},
                {"path": f"{d}/data/v2-sessions/ag-orch/s-x/outbound.db", "message_id": "m3", "status": "completed", "changed": "2026-09-15T18:00:00Z"},
            ]))
            out = Path(d) / "shared" / "acks.json"
            p = self.run_script(d, ACKS_SESSIONS_TSV=str(tsv), ACKS_PROBE_JSON=str(probe), OUT=str(out))
            self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
            doc = json.loads(out.read_text())
            self.assertEqual((doc["generated_at"], doc["source"]), (NOW, "fixture"))
            self.assertEqual(set(doc["sessions"]), {"s-a14", "s-o14", "s-r21", "s-z21", "s-r13"})
            # no host log under this ROOT: the two bounce-history fields are OMITTED (the supervisor then behaves as before)
            self.assertEqual(doc["sessions"]["s-a14"], {
                "status": "bounced-transient", "changed": "2026-09-15T17:00:00.123Z", "message_id": "m1",
                "role": "hermes-architect", "thread_id": "hermes-ISO-F14", "thread_id_raw": "hermes-ISO-F14", "container_status": "stopped",
            })
            self.assertEqual(doc["bounce_log"]["status"], "missing")
            self.assertIn("bounce history off (host log unreadable", p.stdout)
            # the mis-cased thread: attributed to ISO-F13 by the canonical thread_id, the real thread kept, flagged and listed
            r13 = doc["sessions"]["s-r13"]
            self.assertEqual((r13["thread_id"], r13["thread_id_raw"], r13["thread_case"], r13["role"]), ("hermes-ISO-F13", "hermes-iso-f13", True, "hermes-reviewer"))
            self.assertEqual(doc["thread_case"], [{"session_id": "s-r13", "role": "hermes-reviewer", "thread_id": "hermes-ISO-F13", "thread_id_raw": "hermes-iso-f13"}])
            self.assertEqual(doc["counts"]["thread_case"], 1)
            self.assertIn("THREAD-CASE: session s-r13 (hermes-reviewer) lives on thread 'hermes-iso-f13', row thread is 'hermes-ISO-F13'", p.stdout)
            self.assertIn("thread case 1", p.stdout)
            self.assertNotIn("thread_case", doc["sessions"]["s-a14"])
            self.assertEqual(hs.role_ack(doc["sessions"], "hermes-ISO-F13", "hermes-reviewer")["session_id"], "s-r13")
            self.assertEqual(hs.role_ack(doc["sessions"], "hermes-ISO-F13", "hermes-reviewer")["thread_id_raw"], "hermes-iso-f13")
            # role resolution follows collect_threads.role_groups: folder, else name; neither -> folder + role_unmatched
            self.assertEqual((doc["sessions"]["s-r21"]["role"], "role_unmatched" in doc["sessions"]["s-r21"]), ("hermes-reviewer", False))
            self.assertEqual((doc["sessions"]["s-z21"]["role"], doc["sessions"]["s-z21"]["role_unmatched"]), ("hermes-scribe", True))
            self.assertEqual(doc["counts"]["sessions_total"], 9)
            self.assertEqual(doc["counts"]["hermes_sessions"], 7)  # the dotted sub-row and the mis-cased thread count, hermes-status / P0-LOOP do not
            self.assertEqual((doc["counts"]["probed"], doc["counts"]["with_ack"], doc["counts"]["bounced"], doc["counts"]["completed"], doc["counts"]["empty"], doc["counts"]["errors"], doc["counts"]["role_unmatched"]), (7, 5, 1, 4, 1, 1, 1))
            self.assertEqual(doc["errors"], [{"session_id": "s-t13", "error": "SQLiteError: database is locked"}])
            self.assertIn("role unmatched 1", p.stdout)
            self.assertIn(f"-> {out} in ", p.stdout)
            self.assertFalse(Path(str(out) + ".tmp").exists())
            # the file is exactly what hermes_supervise --acks consumes
            self.assertEqual(hs.acks_status(doc, parse_ts(NOW))["status"], "ok")
            self.assertEqual(hs.role_ack(doc["sessions"], "hermes-ISO-F14", "hermes-architect")["session_id"], "s-a14")
            self.assertEqual(hs.role_ack(doc["sessions"], "hermes-ISO-F14", "hermes-architect")["changed"], "2026-09-15T17:00:00Z")

    @staticmethod
    def host_log_line(clock: str, msg: str, **data) -> str:
        """One logs/nanoclaw.log line as src/log.ts writes it: `[HH:MM:SS.mmm]` local clock (NO date), ANSI-coloured
        level and message, `key=<JSON>` pairs with coloured keys."""
        kv = " ".join(f"\x1b[35m{k}\x1b[39m={json.dumps(v)}" for k, v in data.items())
        return f"[{clock}] \x1b[32mINFO\x1b[39m \x1b[36m{msg}\x1b[39m" + (" " + kv if kv else "")

    def rearm_line(self, clock: str, sid: str, tries: int, status: str = "bounced-transient") -> str:
        return self.host_log_line(clock, "Re-armed bounced a2a handoff", sessionId=sid, messageId=f"m-{tries}", status=status, tries=tries, backoffMs=60000)

    def bounce_fixture(self, d: str, lines: list[str], probe_rows: list[dict] | None = None, tsv_rows: str | None = None, mtime_h: float = 0.0) -> tuple:
        """sessions.tsv + probe.json (architect s-a14 completed, orchestrator s-o14 processing by default) and a host log
        of `lines` (oldest first) whose mtime is NOW - mtime_h. Returns (tsv, probe, log, out)."""
        tsv = Path(d) / "sessions.tsv"
        tsv.write_text(tsv_rows or "s-a14|hermes-architect|Hermes Architect|hermes-ISO-F14|stopped|active|ag-arch\n"
                                   "s-o14|orchestrator|Orchestrator|hermes-ISO-F14|running|active|ag-orch\n")
        probe = Path(d) / "probe.json"
        probe.write_text(json.dumps(probe_rows if probe_rows is not None else [
            {"path": f"{d}/data/v2-sessions/ag-arch/s-a14/outbound.db", "message_id": "m1", "status": "completed", "changed": "2026-09-10T11:40:00Z"},
            {"path": f"{d}/data/v2-sessions/ag-orch/s-o14/outbound.db", "message_id": "m2", "status": "processing", "changed": "2026-09-10T11:50:00Z"},
        ]))
        log = Path(d) / "logs" / "nanoclaw.log"
        log.parent.mkdir(exist_ok=True)
        log.write_text("\n".join(lines) + "\n")
        t = parse_ts(NOW).timestamp() - mtime_h * 3600
        os.utime(log, (t, t))
        return tsv, probe, log, Path(d) / "acks.json"

    def run_bounce(self, d: str, tsv: Path, probe: Path, log: Path, out: Path, **env: str) -> tuple:
        p = self.run_script(d, ACKS_SESSIONS_TSV=str(tsv), ACKS_PROBE_JSON=str(probe), OUT=str(out), ACKS_HOST_LOG=str(log), **env)
        self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
        return p, json.loads(out.read_text())

    def test_bounce_history_from_the_host_log(self):
        """ISO-F14, 2026-09-16: three bounces in 66 min, each re-armed by the host sweep, which then cleared the bounced
        ack — acks.json read `completed` at every tick. The sweep's "Re-armed bounced a2a handoff" lines are the durable
        record; they carry a clock but NO date, so lines are dated relative to the file's last write (mtime), a clock
        that runs forward while walking back being a midnight crossing."""
        with tempfile.TemporaryDirectory() as d:
            tsv = Path(d) / "sessions.tsv"
            tsv.write_text(
                "s-a14|hermes-architect|Hermes Architect|hermes-ISO-F14|stopped|active|ag-arch\n"
                "s-o14|orchestrator|Orchestrator|hermes-ISO-F14|running|active|ag-orch\n"
                "s-t13|hermes-tester|hermes-tester|hermes-iso-f13|stopped|active|ag-test\n"
            )
            probe = Path(d) / "probe.json"
            probe.write_text(json.dumps([
                {"path": f"{d}/data/v2-sessions/ag-arch/s-a14/outbound.db", "message_id": "m1", "status": "completed", "changed": "2026-09-10T11:40:00Z"},
                {"path": f"{d}/data/v2-sessions/ag-orch/s-o14/outbound.db", "message_id": "m2", "status": "processing", "changed": "2026-09-10T11:50:00Z"},
                {"path": f"{d}/data/v2-sessions/ag-test/s-t13/outbound.db", "message_id": "m3", "status": "completed", "changed": "2026-09-10T11:00:00Z"},
            ]))
            # The log, oldest first. The last stamped line is the anchor (= the file's mtime = NOW here); every earlier line
            # is dated by its clock distance to the next one. 23:50 -> 00:10 is a midnight crossing (20 min, not -23.7 h).
            log = Path(d) / "logs" / "nanoclaw.log"
            log.parent.mkdir()
            lines = [
                self.rearm_line("17:00:00.000", "s-a14", 0),                                   # NOW - 24.5 h: outside the window
                self.host_log_line("20:00:00.000", "Sweep tick", sessions=3),                  # NOW - 21.5 h
                self.rearm_line("23:50:00.000", "s-a14", 0),                                   # NOW - 17.67 h: counts
                self.host_log_line("00:10:00.000", "Sweep tick", sessions=3),                  # NOW - 17.33 h (after midnight)
                self.host_log_line("00:10:00.500", "Reclaimed non-a2a bounced claim", sessionId="s-a14", messageId="x", status="bounced-unknown", tries=1),  # not a re-arm
                # the 60 s host sweep keeps adjacent stamped lines minutes apart in a real log; here a few ticks stand for it
                self.host_log_line("04:00:00.000", "Sweep tick", sessions=3),
                self.host_log_line("08:00:00.000", "Sweep tick", sessions=3),
                self.host_log_line("12:00:00.000", "Sweep tick", sessions=3),
                self.rearm_line("14:00:00.000", "s-a14", 1),                                   # NOW - 3.5 h
                self.rearm_line("14:30:00.000", "s-zzz", 1),                                   # a session not listed: ignored
                self.rearm_line("15:00:00.000", "s-o14", 1, status="bounced-unknown"),         # NOW - 2.5 h
                self.rearm_line("16:39:00.000", "s-a14", 2),                                   # NOW - 0.85 h
                self.host_log_line("16:40:00.000", "Cleared bounced a2a markers", sessionId="s-a14", cleared=1),
                self.rearm_line("17:00:00.000", "s-a14", 3),                                   # NOW - 0.5 h: the last one
                "  at Object.<anonymous> (unstamped continuation line)",
                self.host_log_line("17:30:00.000", "Sweep tick", sessions=3),                  # the anchor
            ]
            log.write_text("\n".join(lines) + "\n")
            now_epoch = parse_ts(NOW).timestamp()
            os.utime(log, (now_epoch, now_epoch))
            out = Path(d) / "acks.json"
            p = self.run_script(d, ACKS_SESSIONS_TSV=str(tsv), ACKS_PROBE_JSON=str(probe), OUT=str(out), ACKS_HOST_LOG=str(log))
            self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
            doc = json.loads(out.read_text())
            a14, o14, t13 = doc["sessions"]["s-a14"], doc["sessions"]["s-o14"], doc["sessions"]["s-t13"]
            self.assertEqual((a14["status"], a14["bounces_24h"], a14["last_bounce_at"]), ("completed", 4, ago(0.5)))
            self.assertEqual((o14["bounces_24h"], o14["last_bounce_at"]), (1, ago(2.5)))
            self.assertEqual((t13["bounces_24h"], t13["last_bounce_at"], t13["thread_id"], t13["thread_id_raw"]), (0, None, "hermes-ISO-F13", "hermes-iso-f13"))
            bl = doc["bounce_log"]
            self.assertEqual((bl["status"], bl["rearms_24h"], bl["anchor"], bl["note"], bl["window_partial"]), ("ok", 5, NOW, None, False))
            self.assertGreaterEqual(bl["covers_h"], 24.0)
            self.assertEqual((doc["counts"]["bounce_history"], doc["counts"]["rearms_24h"]), (2, 5))
            self.assertIn("bounce history 2 sessions / 5 re-arms 24h (log covers", p.stdout)
            # what hermes_supervise reads from it
            hist = hs.role_bounce_history(doc["sessions"], "hermes-ISO-F14", "hermes-architect")
            self.assertEqual((hist["session_id"], hist["bounces_24h"], hist["last_bounce_at"], hist["status"]), ("s-a14", 4, ago(0.5), "completed"))
            self.assertEqual(hs.role_ack(doc["sessions"], "hermes-ISO-F14", "hermes-architect")["bounces_24h"], 4)

            # A quiet stretch the clock cannot vouch for (the host logs only on events; a quiet night is one): the walk
            # stops at the first > LOG_MAX_GAP_H (6 h) between stamped lines; re-arms beyond it are counted as undated,
            # never as bounces_24h, the note says so, and the window is reported partial.
            log.write_text("\n".join([
                self.rearm_line("08:00:00.000", "s-a14", 0),                                   # beyond a 7 h gap: not counted
                self.rearm_line("15:00:00.000", "s-a14", 1),                                   # NOW - 2.5 h
                self.rearm_line("17:00:00.000", "s-a14", 2),                                   # NOW - 0.5 h
                self.host_log_line("17:30:00.000", "Sweep tick", sessions=3),
            ]) + "\n")
            os.utime(log, (now_epoch, now_epoch))
            p = self.run_script(d, ACKS_SESSIONS_TSV=str(tsv), ACKS_PROBE_JSON=str(probe), OUT=str(out), ACKS_HOST_LOG=str(log))
            self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
            doc = json.loads(out.read_text())
            self.assertEqual((doc["sessions"]["s-a14"]["bounces_24h"], doc["sessions"]["s-a14"]["last_bounce_at"], doc["sessions"]["s-a14"]["bounces_undated"]), (2, ago(0.5), 1))
            self.assertNotIn("bounces_undated", doc["sessions"]["s-o14"])  # only when > 0
            bl = doc["bounce_log"]
            self.assertTrue(bl["note"].startswith("stopped at a 7.0h quiet stretch between stamped lines (08:00:00)"), bl["note"])
            self.assertEqual((bl["window_partial"], bl["covers_h"], bl["rearms_24h"], bl["rearms_undated"], bl["max_gap_h"]), (True, 2.5, 2, 1, 6.0))
            self.assertEqual(doc["counts"]["rearms_undated"], 1)
            self.assertIn("bounce history: stopped at a 7.0h quiet stretch", p.stdout)
            self.assertIn("bounce history 1 sessions / 2 re-arms 24h, 1 undated (log covers 2.5h, partial)", p.stdout)
            # the guard is a knob: LOG_MAX_GAP_H=8 lets the walk cross that stretch and date the 08:00 line (NOW - 9.5 h)
            p = self.run_script(d, ACKS_SESSIONS_TSV=str(tsv), ACKS_PROBE_JSON=str(probe), OUT=str(out), ACKS_HOST_LOG=str(log), LOG_MAX_GAP_H="8")
            self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
            doc = json.loads(out.read_text())
            self.assertEqual((doc["sessions"]["s-a14"]["bounces_24h"], doc["sessions"]["s-a14"]["last_bounce_at"], doc["bounce_log"]["note"], doc["bounce_log"]["max_gap_h"]),
                             (3, ago(0.5), None, 8.0))
            self.assertNotIn("bounces_undated", doc["sessions"]["s-a14"])
            self.assertNotIn("undated", p.stdout)

            # An anchor older than NOW (the host stopped writing 3 h ago): ages are relative to the file's last write.
            old = now_epoch - 3 * 3600
            os.utime(log, (old, old))
            p = self.run_script(d, ACKS_SESSIONS_TSV=str(tsv), ACKS_PROBE_JSON=str(probe), OUT=str(out), ACKS_HOST_LOG=str(log))
            doc = json.loads(out.read_text())
            self.assertEqual((doc["sessions"]["s-a14"]["bounces_24h"], doc["sessions"]["s-a14"]["last_bounce_at"]), (2, ago(3.5)))
            self.assertEqual(doc["bounce_log"]["anchor"], ago(3.0))

    def test_host_start_is_a_dating_boundary(self):
        """A host down ~24.3 h: on the clock the pre-outage re-arms look 0.3 h old and would pass the quiet-stretch guard.
        `NanoClaw starting` (src/index.ts, on every start) marks the gap the clock cannot show, so the walk stops there:
        the earlier re-arms are counted as undated, never as bounces_24h, and no last_bounce_at is made up."""
        with tempfile.TemporaryDirectory() as d:
            # re-arms at 16:00 / 16:10 (really the day before), a host start at 16:30, the anchor at 17:00 (= NOW)
            p, doc = self.run_bounce(d, *self.bounce_fixture(d, [
                self.rearm_line("16:00:00.000", "s-a14", 1),
                self.rearm_line("16:10:00.000", "s-a14", 2),
                self.host_log_line("16:30:00.000", "NanoClaw starting"),
                self.host_log_line("17:00:00.000", "Sweep tick", sessions=2),
            ]))
            a14 = doc["sessions"]["s-a14"]
            self.assertEqual((a14["bounces_24h"], a14["last_bounce_at"], a14["bounces_undated"]), (0, None, 2))
            bl = doc["bounce_log"]
            self.assertTrue(bl["note"].startswith(f"stopped at a host start (16:30:00, {ago(0.5)}); the downtime before it has no clock"), bl["note"])
            self.assertEqual((bl["rearms_24h"], bl["rearms_undated"], bl["window_partial"], bl["covers_h"]), (0, 2, True, 0.5))
            self.assertEqual((doc["counts"]["bounce_history"], doc["counts"]["rearms_undated"]), (0, 2))
            self.assertIn("bounce history 0 sessions / 0 re-arms 24h, 2 undated (log covers 0.5h, partial)", p.stdout)
            self.assertIn("bounce history: stopped at a host start (16:30:00", p.stdout)
            self.assertEqual(hs.role_bounce_history(doc["sessions"], "hermes-ISO-F14", "hermes-architect")["bounces_24h"], 0)  # no repeat from it
            # a restart INSIDE the window: only the re-arms after it are dated and counted
            p, doc = self.run_bounce(d, *self.bounce_fixture(d, [
                self.rearm_line("14:00:00.000", "s-a14", 1),                        # before the start: undated
                self.host_log_line("15:00:00.000", "NanoClaw starting"),            # NOW - 2 h
                self.rearm_line("16:00:00.000", "s-a14", 2),                        # NOW - 1 h
                self.rearm_line("16:30:00.000", "s-a14", 3),                        # NOW - 0.5 h
                self.host_log_line("17:00:00.000", "Sweep tick", sessions=2),
            ]))
            a14 = doc["sessions"]["s-a14"]
            self.assertEqual((a14["bounces_24h"], a14["last_bounce_at"], a14["bounces_undated"]), (2, ago(0.5), 1))
            self.assertEqual((doc["bounce_log"]["covers_h"], doc["bounce_log"]["window_partial"]), (2.0, True))
            self.assertIn(f"host start (15:00:00, {ago(2.0)})", doc["bounce_log"]["note"])
            # a host start OLDER than the window is no boundary: the window is complete, nothing is undated
            p, doc = self.run_bounce(d, *self.bounce_fixture(d, [
                self.rearm_line("15:00:00.000", "s-a14", 1),                        # NOW - 26 h
                self.host_log_line("16:00:00.000", "NanoClaw starting"),            # NOW - 25 h
                self.host_log_line("20:00:00.000", "Sweep tick"), self.host_log_line("00:00:00.000", "Sweep tick"),
                self.host_log_line("04:00:00.000", "Sweep tick"), self.host_log_line("08:00:00.000", "Sweep tick"),
                self.host_log_line("12:00:00.000", "Sweep tick"), self.rearm_line("16:00:00.000", "s-a14", 2),  # NOW - 1 h
                self.host_log_line("17:00:00.000", "Sweep tick"),
            ]))
            self.assertEqual((doc["sessions"]["s-a14"]["bounces_24h"], doc["sessions"]["s-a14"]["last_bounce_at"]), (1, ago(1.0)))
            self.assertEqual((doc["bounce_log"]["note"], doc["bounce_log"]["window_partial"], doc["bounce_log"]["rearms_undated"]), (None, False, 0))
            self.assertNotIn("bounces_undated", doc["sessions"]["s-a14"])

    def test_small_backward_clock_step_is_jitter_not_a_day(self):
        """Two adjacent stamps 100 ms out of order (an NTP slew after a VM resume, a reordered write) must not read as a
        midnight crossing: +24 h would exceed the quiet-stretch guard and silently truncate the window."""
        with tempfile.TemporaryDirectory() as d:
            _, doc = self.run_bounce(d, *self.bounce_fixture(d, [
                self.rearm_line("14:00:00.000", "s-a14", 1),
                self.rearm_line("15:00:00.000", "s-a14", 2),
                self.host_log_line("16:00:00.500", "Sweep tick"),
                self.host_log_line("16:00:00.400", "Sweep tick"),  # the inversion
                self.rearm_line("16:30:00.000", "s-a14", 3),
                self.host_log_line("17:00:00.000", "Sweep tick"),
            ]))
            self.assertEqual((doc["sessions"]["s-a14"]["bounces_24h"], doc["sessions"]["s-a14"]["last_bounce_at"]), (3, ago(0.5)))
            self.assertEqual((doc["bounce_log"]["note"], doc["bounce_log"]["covers_h"], doc["bounce_log"]["rearms_undated"]), (None, 3.0, 0))
            # a real midnight crossing is still one (23:50 -> 00:10 is 20 min, dated 17.67 h back in the main fixture)

    def test_ack_less_session_with_host_rearms_is_surfaced(self):
        """A first-turn tester whose only ack row was the bounced one the sweep DELETED (deleteBouncedClaims, then a backoff
        before the retry is claimed): the probe says `empty`, the log shows three re-arms. It gets an ack-less entry the
        supervisor's bounce-repeat can see; role_ack reads no current ack from it; an empty session without re-arms stays out."""
        with tempfile.TemporaryDirectory() as d:
            tsv_rows = ("s-a14|hermes-architect|Hermes Architect|hermes-ISO-F14|stopped|active|ag-arch\n"
                        "s-t1|hermes-tester|hermes-tester|hermes-ISO-F14|stopped|active|ag-test\n")
            probe_rows = [
                {"path": f"{d}/data/v2-sessions/ag-arch/s-a14/outbound.db", "message_id": "m1", "status": "completed", "changed": "2026-09-10T11:40:00Z"},
                {"path": f"{d}/data/v2-sessions/ag-test/s-t1/outbound.db", "empty": True},
            ]
            p, doc = self.run_bounce(d, *self.bounce_fixture(d, [
                self.rearm_line("15:30:00.000", "s-t1", 1), self.rearm_line("16:00:00.000", "s-t1", 2), self.rearm_line("16:30:00.000", "s-t1", 3),
                self.host_log_line("17:00:00.000", "Sweep tick"),
            ], probe_rows=probe_rows, tsv_rows=tsv_rows))
            self.assertEqual(doc["sessions"]["s-t1"], {
                "status": None, "changed": None, "message_id": None, "ack_empty": True, "role": "hermes-tester", "thread_id": "hermes-ISO-F14",
                "thread_id_raw": "hermes-ISO-F14", "container_status": "stopped", "bounces_24h": 3, "last_bounce_at": ago(0.5),
            })
            self.assertEqual((doc["counts"]["empty"], doc["counts"]["with_ack"], doc["counts"]["bounce_history"], doc["counts"]["rearms_24h"]), (1, 1, 1, 3))
            self.assertIn("acks 1 (bounced 0, completed 1, processing 0)", p.stdout)
            self.assertIn("bounce history 1 sessions / 3 re-arms 24h (log covers 1.5h, partial)", p.stdout)
            self.assertIsNone(hs.role_ack(doc["sessions"], "hermes-ISO-F14", "hermes-tester"))
            self.assertEqual(hs.role_bounce_history(doc["sessions"], "hermes-ISO-F14", "hermes-tester")["bounces_24h"], 3)
            self.assertEqual(hs.acks_status(doc, parse_ts(NOW))["status"], "ok")
            # the same session with no re-arms in the log: not listed, as before
            p, doc = self.run_bounce(d, *self.bounce_fixture(d, [self.host_log_line("17:00:00.000", "Sweep tick")], probe_rows=probe_rows, tsv_rows=tsv_rows))
            self.assertNotIn("s-t1", doc["sessions"])
            self.assertEqual((doc["counts"]["empty"], doc["counts"]["bounce_history"]), (1, 0))

    def test_no_session_source_writes_nothing(self):
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "acks.json"
            p = self.run_script(d, OUT=str(out), NCL=str(Path(d) / "no-such-ncl"))
            self.assertEqual(p.returncode, 2, p.stdout + p.stderr)
            self.assertIn("no session source", p.stdout)
            self.assertFalse(out.exists())
