#!/usr/bin/env python3
"""Tests for the card_missing check in hermes_supervise.py (hermes-task-card).

A terminal role marker on a row thread ([Spec handoff], [Triage Resolution], [Fix Report],
[Fix Review Request], [Test Report], [Review Verdict]) owes one later outbound line that starts
"card · " or "card(html) · ". After card_grace_minutes (default 20) without one, the role gets
one nudge through the ordinary nudge machinery; the nudge names the marker and its timestamp, so
the next tick reads it back from the thread and never repeats it.
Run: python3 -m unittest ops/nemoclaw-coworkers/autopilot/test_card_missing.py
"""

from __future__ import annotations

import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import hermes_supervise as hs

RID = "LOOP-F35"
NOW = "2026-09-10T12:00:00Z"
NOW_DT = datetime(2026, 9, 10, 12, 0, tzinfo=timezone.utc)
SLUG = "slang-coworkers/hermes-agent"


def ago(hours: float) -> str:
    return (NOW_DT - timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%SZ")


def msg(hours: float, text: str, sender: str, direction: str = "out") -> dict:
    return {"ts": ago(hours), "direction": direction, "text": text, "sender": sender, "role": sender}


def handoff(hours: float, pr: int = 7, head: str = "a1b2c3d4e5f6", round_no: int = 2) -> dict:
    return msg(hours, f"[Fix Report] {SLUG}#{pr} (test round {round_no}, head {head}): fixed rows\n- **Head SHA:** `{head}`", "hermes-builder")


def test_report(hours: float, verdict: str = "FAIL", pr: int = 7, head: str = "a1b2c3d", round_no: int = 1) -> dict:
    return msg(hours, f"[Test Report] {SLUG}#{pr} (round {round_no}/2, head {head})\n- **Verdict:** {verdict}", "hermes-tester")


def card(hours: float, role: str = "hermes-tester", outcome: str = "FAIL", html: bool = False) -> dict:
    prefix = "card(html) · " if html else "card · "
    return msg(hours, f"{prefix}{RID} · {role} · {outcome} — three scenarios red, one PR ref", role)


def state() -> dict:
    return {
        "rows": {RID: {"state": "dispatched", "batch": "1a", "dispatched_at": ago(30), "ledger": {"dispatched_at": ago(30)}}},
        "in_flight": [RID],
        "gating": {},
    }


def run(thread: list | None, config: dict | None = None, nudges: dict | None = None) -> tuple[dict, dict]:
    out = hs.supervise(state(), {f"hermes-{RID}": thread}, [], nudges or {}, NOW, config=config or {})
    return out, out["rows"][RID]


class CardMissingTest(unittest.TestCase):
    def test_marker_without_card_nudges_the_role_after_the_grace(self):
        # builder hand-off 3 h ago with its card (testing, 3 h < 6 h SLO: no SLO nudge), tester FAIL 2 h ago, no card
        out, rec = run([handoff(3.0), card(2.9, "hermes-builder", "FIXED"), test_report(2.0)])
        self.assertEqual(rec["action"], "nudge")
        self.assertEqual(rec["target_role"], "hermes-tester")
        self.assertEqual(len(out["actions"]), 1)
        a = out["actions"][0]
        self.assertEqual((a["kind"], a["row"], a["target_role"], a["thread_id"], a["check"]), ("nudge", RID, "hermes-tester", f"hermes-{RID}", "card_missing"))
        self.assertEqual(a["marker"], "[Test Report]")
        self.assertEqual(a["marker_ts"], ago(2.0))
        self.assertTrue(a["text"].startswith(f"Supervisor nudge {RID}: no task card after your [Test Report] at {ago(2.0)} (120 min ago)."), a["text"])
        self.assertIn(f"Run /hermes-task-card for {RID} and send_file the PNG as a reply to the same intake id", a["text"])
        self.assertIn(f'"card · {RID} · hermes-tester · <OUTCOME> — <headline>"', a["text"])
        self.assertEqual(out["summary"]["must_nudge"], 1)
        self.assertEqual(out["summary"]["card_missing"], 1)
        self.assertEqual(rec["cards"]["carded"], 1)
        self.assertEqual([m["marker"] for m in rec["cards"]["missing"]], ["[Test Report]"])

    def test_oldest_missing_marker_is_nudged_first(self):
        out, _ = run([handoff(3.0), test_report(2.0)])
        self.assertEqual(out["actions"][0]["marker"], "[Fix Report]")
        self.assertEqual(out["actions"][0]["target_role"], "hermes-builder")
        # the nudge text is a plain nudge line the classifier recognises (kind nudge), so it books itself next tick
        ev = hs.classify_message({"ts": NOW, "text": out["actions"][0]["text"]}, RID)
        self.assertEqual(ev["kind"], "nudge")

    def test_card_after_the_marker_satisfies_it(self):
        out, rec = run([handoff(3.0), card(2.9, "hermes-builder", "FIXED"), test_report(2.0), card(1.9)])
        self.assertEqual(rec["action"], "none")
        self.assertEqual(rec["cards"], {"markers": 2, "carded": 2, "pending": [], "missing": [], "nudged": []})
        self.assertEqual(out["summary"]["card_missing"], 0)

    def test_html_fallback_caption_counts(self):
        _, rec = run([handoff(3.0), card(2.9, "hermes-builder", "FIXED", html=True), test_report(2.0), card(1.9, html=True)])
        self.assertEqual(rec["action"], "none")
        self.assertEqual(rec["cards"]["carded"], 2)

    def test_card_before_the_marker_does_not_count(self):
        _, rec = run([handoff(3.0), card(2.9, "hermes-builder", "FIXED"), card(2.5), test_report(2.0)])
        self.assertEqual([m["marker"] for m in rec["cards"]["missing"]], ["[Test Report]"])
        self.assertEqual(rec["action"], "nudge")
        self.assertEqual(rec["target_role"], "hermes-tester")

    def test_inside_the_grace_window_is_pending_not_missing(self):
        _, rec = run([handoff(3.0), card(2.9, "hermes-builder", "FIXED"), test_report(10 / 60)])
        self.assertEqual(rec["action"], "none")
        self.assertEqual(rec["cards"]["missing"], [])
        self.assertEqual([m["marker"] for m in rec["cards"]["pending"]], ["[Test Report]"])
        self.assertAlmostEqual(rec["cards"]["pending"][0]["age_minutes"], 10.0)

    def test_grace_is_configurable(self):
        _, rec = run([handoff(3.0), card(2.9, "hermes-builder", "FIXED"), test_report(2.0)], config={"card_grace_minutes": 180})
        self.assertEqual(rec["action"], "none")
        self.assertEqual([m["marker"] for m in rec["cards"]["pending"]], ["[Test Report]"])
        _, rec = run([handoff(3.0), card(2.9, "hermes-builder", "FIXED"), test_report(2.0)], config={"card_grace_minutes": "garbage"})
        self.assertEqual(rec["action"], "nudge")   # unparsable knob: the 20 min default

    def test_one_nudge_per_marker_read_back_from_the_thread(self):
        # FAIL 7.5 h ago (building 7.5 h < 8 h SLO), our own card nudge 7 h ago (outside the 6 h row bound): nothing new
        thread = [handoff(8.0), card(7.9, "hermes-builder", "FIXED"), test_report(7.5)]
        first, _ = run(thread)
        self.assertEqual(first["actions"][0].get("check"), "card_missing")
        nudge_text = first["actions"][0]["text"]
        # On the box the nudge is sent from the Orchestrator's task session (not collected), so the
        # hermes-<ROW> thread carries it ONLY as the role's inbound copy — no "out" line exists.
        thread.append(msg(7.0, nudge_text, "orchestrator", direction="in"))
        audit = hs.card_audit(thread, RID, NOW_DT, grace_minutes=20)
        self.assertEqual([m["marker"] for m in audit["nudged"]], ["[Test Report]"])
        self.assertEqual(audit["missing"], [])
        out, rec = run(thread)
        self.assertEqual(rec["action"], "none", rec["reason"])
        self.assertEqual([m["marker"] for m in rec["cards"]["nudged"]], ["[Test Report]"])
        self.assertEqual(rec["cards"]["missing"], [])
        self.assertEqual(out["summary"]["card_missing"], 0)
        self.assertEqual(out["actions"], [])

    def test_a_later_marker_of_the_same_kind_gets_its_own_nudge(self):
        # round-1 FAIL 9 h ago was nudged for its card 8 h ago; the round-2 PASS 1 h ago (review, 1 h < 4 h SLO) owes its own
        nudged = hs.CARD_NUDGE_TEMPLATE.format(id=RID, mark=hs.CARD_NUDGE_MARK, marker="[Test Report]", ts=ago(9.0), m=60, role="hermes-tester")
        thread = [
            handoff(10.0), card(9.9, "hermes-builder", "FIXED"), test_report(9.0, round_no=1),
            msg(8.0, nudged, "orchestrator"),
            handoff(3.0, head="b2c3d4e5f6a1"), card(2.9, "hermes-builder", "FIXED"),
            test_report(1.0, "PASS", head="b2c3d4e", round_no=2),   # round 2 report, still no card
        ]
        out, rec = run(thread)
        self.assertEqual(rec["stage"], "review")
        self.assertEqual([m["marker"] for m in rec["cards"]["nudged"]], ["[Test Report]"])
        self.assertEqual([(m["marker"], m["ts"]) for m in rec["cards"]["missing"]], [("[Test Report]", ago(1.0))])
        self.assertEqual(out["actions"][0]["marker_ts"], ago(1.0))

    def test_two_builder_markers_need_two_cards(self):
        thread = [handoff(5.0), msg(3.0, f"[Fix Review Request] {SLUG}#7 head a1b2c3d: please re-review", "hermes-builder"), card(2.5, "hermes-builder", "FIXED")]
        _, rec = run(thread)
        self.assertEqual(rec["cards"]["carded"], 1)
        self.assertEqual([(m["marker"], m["ts"]) for m in rec["cards"]["missing"]], [("[Fix Report]", ago(5.0))])
        self.assertEqual(rec["target_role"], "hermes-builder")

    def test_slo_nudge_takes_precedence_and_the_row_bound_holds(self):
        # testing for 7 h (SLO 6 h): the SLO nudge fires; the missing card is counted but draws no second nudge
        out, rec = run([handoff(7.0)])
        self.assertEqual(rec["action"], "nudge")
        self.assertEqual(len(out["actions"]), 1)
        self.assertNotIn("check", out["actions"][0])
        self.assertTrue(out["actions"][0]["text"].startswith(f"Supervisor nudge {RID}: testing"), out["actions"][0]["text"])
        self.assertEqual(out["summary"]["must_nudge"], 1)
        self.assertEqual(out["summary"]["card_missing"], 1)
        # a nudge on the row 2 h ago (any kind) holds the 6 h bound for the card nudge too
        out, rec = run([handoff(3.0), card(2.9, "hermes-builder", "FIXED"), test_report(2.0)], nudges={RID: {"last_nudge": ago(2.0), "state": "testing", "count": 1}})
        self.assertEqual(rec["action"], "none")
        self.assertIn("card nudge bound", rec["reason"])
        self.assertEqual(out["summary"]["card_missing"], 1)

    def test_since_config_ignores_markers_that_predate_the_skill(self):
        _, rec = run([handoff(3.0), test_report(2.0)], config={"card_missing_since": ago(1.0)})
        self.assertEqual(rec["cards"], {"markers": 0, "carded": 0, "pending": [], "missing": [], "nudged": []})
        self.assertEqual(rec["action"], "none")
        _, rec = run([handoff(3.0), test_report(2.0)], config={"card_missing_since": ago(2.5)})
        self.assertEqual([m["marker"] for m in rec["cards"]["missing"]], ["[Test Report]"])

    def test_inbound_copies_and_duplicates_collapse(self):
        thread = [
            handoff(3.0), card(2.9, "hermes-builder", "FIXED"),
            test_report(2.0),                                   # tester's out
            {**test_report(2.0), "direction": "in", "sender": "hermes-builder"},   # the receiver's copy
            {**test_report(2.0), "ts": ago(2.0 - 5 / 60)},      # a second out copy 5 min later (another session)
        ]
        _, rec = run(thread)
        self.assertEqual(rec["cards"]["markers"], 2)
        self.assertEqual(len(rec["cards"]["missing"]), 1)

    def test_card_role_from_caption_else_sender(self):
        # caption names the role: attributed to the tester's marker even when sent from another session
        _, rec = run([handoff(3.0), card(2.9, "hermes-builder", "FIXED"), test_report(2.0), {**card(1.9), "sender": "orchestrator", "role": "orchestrator"}])
        self.assertEqual(rec["cards"]["missing"], [])
        # a malformed caption falls back to the sender
        _, rec = run([handoff(3.0), card(2.9, "hermes-builder", "FIXED"), test_report(2.0), msg(1.9, "card · something else entirely", "hermes-tester")])
        self.assertEqual(rec["cards"]["missing"], [])

    def test_unreadable_merged_and_cost_held_rows_are_left_alone(self):
        out, rec = run(None)
        self.assertIsNone(rec["cards"])
        self.assertEqual(out["actions"], [])
        merged = state()
        merged["rows"][RID]["state"] = "merged"
        out = hs.supervise(merged, {f"hermes-{RID}": [handoff(3.0), test_report(2.0)]}, [], {}, NOW)
        self.assertEqual(out["rows"][RID]["stage"], "merged")
        self.assertIsNone(out["rows"][RID]["cards"])
        sessions = {f"hermes-{RID}": [{"role": "hermes-tester", "session_id": "s1", "cost_status": "stopped"}]}
        out = hs.supervise(state(), {f"hermes-{RID}": [handoff(3.0), test_report(2.0)]}, [], {}, NOW, sessions=sessions)
        self.assertTrue(out["rows"][RID]["cost_hold"])
        self.assertIsNone(out["rows"][RID]["cards"])
        self.assertEqual([a["kind"] for a in out["actions"]], ["alert"])

    def test_audit_is_pure_and_tolerates_junk(self):
        audit = hs.card_audit([{"ts": "not a time", "text": "[Test Report] x"}, {"text": "[Test Report] y"}, {"ts": ago(1), "text": None}], RID, NOW_DT)
        self.assertEqual(audit, {"markers": 0, "carded": 0, "pending": [], "missing": [], "nudged": []})
        self.assertEqual(hs.card_audit([], RID, NOW_DT)["markers"], 0)


if __name__ == "__main__":
    unittest.main()
