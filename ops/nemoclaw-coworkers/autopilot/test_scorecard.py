#!/usr/bin/env python3
"""Tests for scorecard.py: ledger parsing rules (header-located outcome column,
whole-cell id match, anywhere-in-cell merged/blocked token scan), alert window,
plan-hash and tick-staleness flags, and graceful degradation on missing files.
The ledger fixture mirrors the box's shape: a merged P0-LOOP (non-matrix row
with the `✅ MERGED` cell) and an in-flight LOOP-F35 with lone-dash cells."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from datetime import timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import scorecard

NOW = "2026-09-09T12:00:00Z"
IST = timedelta(hours=5, minutes=30)

LEDGER = """# Hermes PORT — work-item ledger

| row-id | dispatched | spec accepted | PR | verdict | merged/blocked | notes |
| --- | --- | --- | --- | --- | --- | --- |
| P2-PREFLIGHT | 2026-09-03 14:37 (to hermes-tester) | n/a — preflight | n/a — no PR | ROUND 3 COMPLETE | none blocking | preflight |
| P0-LOOP | 2026-09-08 13:18 (to hermes-architect, thread `hermes-P0-LOOP`) | 2026-09-08 14:57 (round 1) | **#1 (draft)** slang-coworkers/hermes-agent @`1c2d651` | test round 2/2 = FAIL | **ROUND 3/3 VERIFIED — 3/3 ACs PASS @`888ce15`** ... **✅ MERGED `0f12e89` (squash) into `release/v2026.8.31-e2e-fixed` — https://github.com/slang-coworkers/hermes-agent/pull/1** | rehearsal |
| LOOP-F35 | 2026-09-09 12:20 IST (to hermes-architect, thread `hermes-LOOP-F35`) | 2026-09-09 15:27 IST (round 1, no bounce) | — | — | — | Batch 1a |
| MEM-F44 | 2026-09-09 08:00 UTC (to hermes-architect, thread `hermes-MEM-F44`) | — | — | — | — | Batch 1b wave 1 |
| OPS-F58.a | 2026-09-08 10:00 IST (to hermes-architect) | 2026-09-08 11:00 IST | #7 | round 2/2 FAIL | blocked: STOP cap — test FAIL ×2 | capped |
| OPS-F58 | 2026-09-08 10:00 IST | — | — | — | — | should not swallow OPS-F58.a |
"""

ALERTS = """# Hermes autopilot alerts (newest first)

Appended by the supervise tick.

- 2026-09-09T11:30:00Z · MEM-F44 · dispatched 12h · no [Spec handoff] · nudged 1× · decision: re-dispatch or wait · thread hermes-MEM-F44
- 2026-09-08T20:00:00Z · OPS-F58.a · blocked 0h · cap exhausted · nudged 0× · decision: re-spec or drop · PR #7 · thread hermes-OPS-F58.a
"""

STATE = {
    # the shape pull-state.sh writes: hermes_queue.py output + "supervise" (hermes_supervise.py output)
    "generated_at": "2026-09-09T10:47:00Z",
    "wip": {"limit": 3, "in_flight": 3, "free": 0},
    "config": {"wip": 3, "paused": False},
    "plan": {"sha256": "abc123" * 10 + "abcd"},
    "in_flight": ["LOOP-F35", "MEM-F44", "OPS-F58"],
    "eligible_next": [{"id": "OBS-F46", "batch": "1b", "disposition": "CONFIGURE"}],
    "rows": {
        "LOOP-F35": {"state": "spec_handoff", "batch": "1a", "ledger": {"pr": None}},
        "MEM-F44": {"state": "dispatched", "batch": "1b"},
    },
    "supervise": {
        "rows": {
            "LOOP-F35": {"stage": "spec_handoff", "clock_start": "2026-09-09T09:57:00Z", "age_hours": 2.0, "slo_status": "ok",
                         "last_activity": "2026-09-09T09:57:00Z", "hold": None, "cost_hold": False, "pr": None},
            "MEM-F44": {"stage": "dispatched", "clock_start": "2026-09-09T08:00:00Z", "age_hours": 4.0, "slo_status": "breached",
                        "last_activity": None, "hold": None, "cost_hold": False, "pr": None},
        },
    },
    "actions": [{"kind": "nudge", "row": "LOOP-F35", "target_role": "hermes-architect", "text": "Supervisor nudge LOOP-F35: ..."}],
    "collector_errors": [{"source": "gh pr list", "error": "exit 1: rate limited"}],
}

PRS = [
    {"number": 1, "title": "feat(plugins): hello [P0-LOOP]", "state": "MERGED", "isDraft": False, "headRefOid": "888ce153872095445cdc7767309d8ee92ca6d371", "updatedAt": "2026-09-09T06:35:00Z"},
    {"number": 2, "title": "feat(plugins): nv-coworker-compose [LOOP-F35]", "state": "OPEN", "isDraft": True, "headRefOid": "0123456789abcdef", "updatedAt": "2026-09-09T11:00:00Z"},
]


class LedgerParseTest(unittest.TestCase):
    def setUp(self):
        self.parsed = scorecard.parse_ledger(LEDGER, IST)

    def test_matrix_rows_only_and_whole_cell_ids(self):
        rows = self.parsed["rows"]
        self.assertEqual(set(rows), {"LOOP-F35", "MEM-F44", "OPS-F58.a", "OPS-F58"})
        self.assertEqual(sorted(self.parsed["other_rows"]), ["P0-LOOP", "P2-PREFLIGHT"])

    def test_decorated_id_cell_is_read_as_the_id(self):
        text = LEDGER.replace("| LOOP-F35 |", "| LOOP-F35 (1a) |").replace("| MEM-F44 |", "| [MEM-F44] |")
        parsed = scorecard.parse_ledger(text, IST)
        self.assertEqual(set(parsed["rows"]), {"LOOP-F35", "MEM-F44", "OPS-F58.a", "OPS-F58"})
        self.assertEqual(parsed["rows"]["LOOP-F35"]["id_cell_raw"], "LOOP-F35 (1a)")
        self.assertEqual(parsed["rows"]["LOOP-F35"]["stage"], "spec_handoff")
        self.assertEqual(sorted(parsed["other_rows"]), ["P0-LOOP", "P2-PREFLIGHT"])
        self.assertEqual([s["row"] for s in parsed["spelling"]], ["LOOP-F35", "MEM-F44"])
        self.assertEqual(self.parsed["spelling"], [])
        self.assertNotIn("id_cell_raw", self.parsed["rows"]["LOOP-F35"])

    def test_merged_token_anywhere_in_cell(self):
        # The P0-LOOP shape: `**ROUND 3/3 ... ✅ MERGED `0f12e89` ... /pull/1**`, no ^merged anchor.
        parsed = scorecard.parse_ledger(LEDGER.replace("| P0-LOOP |", "| GOV-F24 |"), IST)
        self.assertEqual(parsed["rows"]["GOV-F24"]["outcome"], "merged")
        self.assertEqual(parsed["rows"]["GOV-F24"]["pr"], 1)

    def test_blocked_and_in_flight_stages(self):
        rows = self.parsed["rows"]
        self.assertEqual(rows["OPS-F58.a"]["outcome"], "blocked")
        self.assertEqual(rows["OPS-F58.a"]["pr"], 7)
        self.assertEqual(rows["LOOP-F35"]["stage"], "spec_handoff")
        self.assertEqual(rows["MEM-F44"]["stage"], "dispatched")

    def test_stamps_honour_named_zone_and_install_default(self):
        rows = self.parsed["rows"]
        self.assertEqual(rows["LOOP-F35"]["dispatched_at"], "2026-09-09T06:50:00Z")  # 12:20 IST
        self.assertEqual(rows["MEM-F44"]["dispatched_at"], "2026-09-09T08:00:00Z")  # explicit UTC
        self.assertEqual(rows["OPS-F58"]["dispatched_at"], "2026-09-08T04:30:00Z")  # named IST beats the default
        zoneless = LEDGER.replace("| OPS-F58 | 2026-09-08 10:00 IST |", "| OPS-F58 | 2026-09-08 10:00 |")
        self.assertEqual(scorecard.parse_ledger(zoneless, IST)["rows"]["OPS-F58"]["dispatched_at"], "2026-09-08T04:30:00Z")
        self.assertEqual(scorecard.parse_ledger(zoneless, timedelta(0))["rows"]["OPS-F58"]["dispatched_at"], "2026-09-08T10:00:00Z")

    def test_last_token_wins(self):
        text = LEDGER.replace("| blocked: STOP cap — test FAIL ×2 |", "| blocked: P3 — retest; later merged 1234567 — /pull/7 |")
        self.assertEqual(scorecard.parse_ledger(text, IST)["rows"]["OPS-F58.a"]["outcome"], "merged")

    def test_duplicate_rows_last_wins_and_flagged(self):
        text = LEDGER + "| MEM-F44 | 2026-09-09 09:00 UTC | 2026-09-09 10:00 UTC | — | — | — | dup |\n"
        parsed = scorecard.parse_ledger(text, IST)
        self.assertEqual(parsed["duplicates"], ["MEM-F44"])
        self.assertEqual(parsed["rows"]["MEM-F44"]["stage"], "spec_handoff")

    def test_escaped_pipe_inside_cell(self):
        text = LEDGER.replace("| Batch 1a |", "| `hermes wire add\\|remove\\|list` |")
        parsed = scorecard.parse_ledger(text, IST)
        self.assertEqual(parsed["rows"]["LOOP-F35"]["outcome"], "in_flight")

    def test_carried_criteria_table_is_not_the_work_list(self):
        # ledger.md's second table (hermes_queue.parse_carried_criteria). Its row `| AC-LOOP-F35-5 | LOOP-F35 | ... |`
        # names exactly one id token and would otherwise read as a decorated LOOP-F35 row: a duplicate with garbage cells.
        text = LEDGER + (
            "\n## Carried criteria\n\n"
            "| criterion | from row | to row | reason | decided | status |\n"
            "| --- | --- | --- | --- | --- | --- |\n"
            "| AC-LOOP-F35-5 | LOOP-F35 | CRED-F28 | needs the podman box | operator 2026-09-10 | open |\n"
        )
        parsed = scorecard.parse_ledger(text, IST)
        self.assertEqual(set(parsed["rows"]), {"LOOP-F35", "MEM-F44", "OPS-F58.a", "OPS-F58"})
        self.assertEqual((parsed["duplicates"], parsed["spelling"]), ([], []))
        self.assertEqual(sorted(parsed["other_rows"]), ["P0-LOOP", "P2-PREFLIGHT"])
        self.assertEqual(parsed["rows"]["LOOP-F35"]["stage"], "spec_handoff")
        self.assertEqual(parsed["rows"]["LOOP-F35"]["dispatched_at"], "2026-09-09T06:50:00Z")


class AlertsTest(unittest.TestCase):
    def test_parse_alerts(self):
        alerts = scorecard.parse_alerts(ALERTS)
        self.assertEqual([a["row"] for a in alerts], ["MEM-F44", "OPS-F58.a"])
        self.assertEqual(alerts[0]["at"], "2026-09-09T11:30:00Z")


class BuildTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        (self.dir / "ledger.md").write_text(LEDGER)
        (self.dir / "alerts.md").write_text(ALERTS)
        (self.dir / "state.json").write_text(json.dumps(STATE))
        (self.dir / "prs.json").write_text(json.dumps(PRS))
        (self.dir / "config.json").write_text(json.dumps({"wip": 3, "paused": False, "paused_rows": ["OPS-F58"]}))
        self.now = scorecard.parse_iso(NOW)

    def tearDown(self):
        self.tmp.cleanup()

    def build(self, **kw):
        return scorecard.build(str(self.dir), self.now, kw.get("plan_sha"), kw.get("plan"), IST)

    def test_counts_and_queue(self):
        card = self.build()
        self.assertEqual(card["in_flight"], ["LOOP-F35", "MEM-F44", "OPS-F58"])
        self.assertEqual(card["blocked"], ["OPS-F58.a"])
        self.assertEqual(card["merged"], [])
        self.assertEqual(card["queued"], 33 - 4)  # DEFAULT_DISPATCHABLE (no plan path): 33 dispatched rows since OSH-F63 / OSH-F64 (batch 6, 2026-09-17)
        self.assertEqual(card["wip_limit"], 3)

    def test_decorated_id_cell_draws_attention_and_a_note(self):
        (self.dir / "ledger.md").write_text(LEDGER.replace("| LOOP-F35 |", "| LOOP-F35 (1a) |"))
        card = self.build()
        self.assertIn("LOOP-F35", card["in_flight"])
        self.assertEqual(card["id_spelling"], [{"row": "LOOP-F35", "cell": "LOOP-F35 (1a)"}])
        self.assertTrue(card["attention"])
        self.assertIn("read as LOOP-F35; make the cell the bare id", scorecard.render(card))

    def test_state_rows_take_priority_and_flags(self):
        card = self.build()
        text = scorecard.render(card)
        self.assertIn("LOOP-F35     spec_handoff", text)
        self.assertIn("slo ok", text)
        self.assertIn("[state]", text)
        self.assertIn("OPS-F58      dispatched", text)
        self.assertIn("[ledger] paused", text)
        self.assertIn("MEM-F44 dispatched 4h", " ".join(card["breaches"]))

    def test_queue_row_shape_is_the_fallback_when_no_supervise_block(self):
        st = json.loads((self.dir / "state.json").read_text())
        del st["supervise"]
        st["rows"]["LOOP-F35"]["dispatched_at"] = "2026-09-09T06:50:00Z"
        (self.dir / "state.json").write_text(json.dumps(st))
        view = scorecard.row_state_from_state(st, "LOOP-F35")
        self.assertEqual(view["state"], "spec_handoff")
        self.assertEqual(view["since"], "2026-09-09T06:50:00Z")
        self.assertEqual(view["slo"], "unknown")

    def test_alert_window_6h(self):
        card = self.build()
        self.assertEqual(len(card["recent_alerts"]), 1)
        self.assertIn("MEM-F44", card["recent_alerts"][0])
        self.assertEqual(card["alerts_total"], 2)

    def test_tick_staleness(self):
        card = self.build()
        self.assertEqual(card["tick_age_h"], 1.2)
        self.assertFalse(card["tick_stale"])
        stale = json.loads((self.dir / "state.json").read_text())
        stale["generated_at"] = "2026-09-09T05:00:00Z"
        (self.dir / "state.json").write_text(json.dumps(stale))
        self.assertTrue(self.build()["tick_stale"])

    def test_plan_hash_change(self):
        self.assertFalse(self.build(plan_sha=STATE["plan"]["sha256"])["plan_changed"])
        card = self.build(plan_sha="deadbeef")
        self.assertTrue(card["plan_changed"])
        self.assertTrue(card["attention"])
        self.assertIn("plan hash: CHANGED", scorecard.render(card))

    def test_fork_counts_and_eligible(self):
        card = self.build()
        self.assertEqual(card["fork_counts"], {"open": 1, "draft": 1, "merged": 1, "closed": 0})
        self.assertEqual(card["eligible_next"], ["OBS-F46"])
        self.assertIn("gh pr list", scorecard.render(card))

    def test_missing_state_degrades_to_ledger(self):
        (self.dir / "state.json").unlink()
        (self.dir / "prs.json").unlink()
        card = self.build()
        self.assertTrue(any("state.json missing" in n for n in card["notes"]))
        self.assertTrue(card["tick_stale"])
        self.assertIn("LOOP-F35     spec_handoff", scorecard.render(card))
        self.assertIn("slo unknown", scorecard.render(card))

    def test_cli_exits_zero_even_on_empty_dir(self):
        empty = tempfile.mkdtemp()
        proc = subprocess.run([sys.executable, str(HERE / "scorecard.py"), "--dir", empty, "--now", NOW],
                              capture_output=True, text=True, check=False)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("ledger.md missing", proc.stdout)
        self.assertIn("status: ATTENTION", proc.stdout)


class DecisionStampsTest(unittest.TestCase):
    """scorecard.decision_stamps — the header-located twin of hermes_queue.parse_decision_stamps' `at` / `answered`, read off
    the FULL notes cell for abtr.decision_lines: a stamp is `answered` when ANSWERED (any case, markdown stripped) or DEFAULT
    APPLIED stands anywhere later in the same cell; an ANSWERED dated before the stamp answers an older decision only."""

    def test_answered_after_the_stamp_is_read_off_the_full_cell(self):
        far = ("decision-needed:none ISO-F11 2026-09-17T09:00:00Z — file the adapter doc upstream?; hold: x (autopilot 2026-09-17T10:00Z); "
               + "note " * 300 + "; ANSWERED 2026-09-18T11:08Z operator option 1")
        expect = [{"at": "2026-09-17T09:00:00Z", "answered": True, "answered_at": "2026-09-18T11:08:00Z", "text": "file the adapter doc upstream?"}]
        self.assertEqual(scorecard.decision_stamps(far, IST), expect)
        text = LEDGER.replace("| Batch 1a |", f"| {far} |")
        row = scorecard.parse_ledger(text, IST)["rows"]["LOOP-F35"]
        self.assertEqual(row["decisions"], expect)
        self.assertLessEqual(len(row["notes"]), 240)  # the note preview stays clipped; the decision read did not
        # begins with ANSWERED; bold; lowercase; DEFAULT APPLIED; `unanswered` never; a zone-less stamp reads in the install zone
        self.assertTrue(scorecard.decision_stamps("decision-needed:none CH-F50 2026-09-18T09:00:00Z — ANSWERED 2026-09-18: operator ruled option 2", IST)[0]["answered"])
        bold = scorecard.decision_stamps("**decision-needed:C.1** CH-F49 2026-09-17T12:25:00Z — r3?; **ANSWERED 2026-09-17T14:27Z (operator, msg 140): AUTHORIZED r3**", IST)[0]
        self.assertEqual((bold["answered"], bold["answered_at"], bold["text"]), (True, "2026-09-17T14:27:00Z", "r3?; **ANSWERED 2026-09-17T14:27Z (operator, msg 140): AUTHORIZED r3**"))
        self.assertTrue(scorecard.decision_stamps("decision-needed:none X-F1 2026-09-21T03:00:00Z — q; answered by the operator: no", IST)[0]["answered"])
        self.assertTrue(scorecard.decision_stamps("decision-needed:C.2 X-F1 2026-09-21T03:00:00Z — carry?; DEFAULT APPLIED — carried — veto within 12 h", IST)[0]["answered"])
        self.assertFalse(scorecard.decision_stamps("decision-needed:none X-F1 2026-09-21T03:00:00Z — default if unanswered by 05:00Z: option 2; still unanswered", IST)[0]["answered"])
        self.assertEqual(scorecard.decision_stamps("decision-needed:none X-F1 2026-09-21 08:30 — q", IST), [{"at": "2026-09-21T03:00:00Z", "answered": False, "answered_at": None, "text": "q"}])
        # ANSWERED must start a clause (mid-sentence inside an open question closes nothing); a zone-less answer ISO reads in the
        # STAMP's zone; only the ISO adjacent to ANSWERED is its date (a referenced earlier time leaves the answer undated -> closes)
        self.assertFalse(scorecard.decision_stamps("decision-needed:none FLEET-F62 2026-09-21T02:00:00Z — the tester says AC-7 is answered by the fixture alone; accept that?", IST)[0]["answered"])
        zl = scorecard.decision_stamps("decision-needed:none FLEET-F62 2026-09-21T02:00:00Z — q; ANSWERED 2026-09-21T04:00 operator: option 1", IST)[0]
        self.assertEqual((zl["answered"], zl["answered_at"]), (True, "2026-09-21T04:00:00Z"))
        ref = scorecard.decision_stamps("decision-needed:none FLEET-F62 2026-09-21T02:00:00Z — q; ANSWERED (per the operator's 2026-09-20T16:00:00Z card ruling): option 1", IST)[0]
        self.assertEqual((ref["answered"], ref["answered_at"]), (True, None))
        # the question ends at the next stamp or `; key:` note, like hermes_queue's
        two = scorecard.decision_stamps("decision-needed:none X-F1 2026-09-21T03:00:00Z — q1; hold: batch6; delegated:round X-F1 2026-09-21T04:00Z — r3; decision-needed:none X-F1 2026-09-21T08:24:00Z — q2", IST)
        self.assertEqual([d["text"] for d in two], ["q1", "q2"])
        # the FLEET-F62 shape: the older decision answered at 06:48Z, the 08:24Z stamp open; the answer appended at the end,
        # dated before the newer stamp, closes the older one only
        fleet = ("decision-needed:none FLEET-F62 2026-09-21T03:00:00Z — BAR DECISION: authorize round 6?; ANSWERED 2026-09-21T06:48Z operator: yes; "
                 "decision-needed:none FLEET-F62 2026-09-21T08:24:00Z — next bar?")
        self.assertEqual([d["answered"] for d in scorecard.decision_stamps(fleet, IST)], [True, False])
        appended = "decision-needed:none X-F1 2026-09-21T03:00:00Z — q1; decision-needed:none X-F1 2026-09-21T08:24:00Z — q2; ANSWERED 2026-09-21T06:48Z operator: q1 yes"
        self.assertEqual([d["answered"] for d in scorecard.decision_stamps(appended, IST)], [True, False])
        self.assertEqual([d["answered_at"] for d in scorecard.decision_stamps(fleet, IST)], ["2026-09-21T06:48:00Z", None])
        self.assertEqual(scorecard.decision_stamps("", IST), [])
        self.assertEqual(scorecard.decision_stamps("delegated:round X-F1 2026-09-21T03:00:00Z — r3; operator ruling B", IST), [])  # only decision-needed stamps


class ParseIsoTest(unittest.TestCase):
    def test_iso_variants(self):
        self.assertEqual(scorecard.parse_iso("2026-09-09T12:00:00Z").tzinfo, timezone.utc)
        self.assertIsNone(scorecard.parse_iso("garbage"))
        self.assertIsNone(scorecard.parse_iso(None))


if __name__ == "__main__":
    unittest.main()
