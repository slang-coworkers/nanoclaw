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


def run(st: dict, threads: dict, prs: list | None = None, nudges: dict | None = None, sessions: dict | None = None, config: dict | None = None) -> dict:
    return hs.supervise(st, threads, prs or [], nudges or {}, NOW, sessions=sessions, config=config)


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
