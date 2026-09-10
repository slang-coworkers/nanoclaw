#!/usr/bin/env python3
"""Tests for abtr.py (the a | b | t | r markdown) and its scorecard.py CLI flags. One fixture:
a building row (a ✓, b ▶), a tester-FAIL-round-2 row, a testing row, a review row at the gate on
hold, a paused row, a ledger-only dispatched row, one blocked and one merged row. Pins the header
counts, the cell tokens, the `·` for not-started, the line width and determinism for a fixed now."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from datetime import timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import abtr
import scorecard

NOW_ISO = "2026-09-09T21:00:00Z"
NOW = abtr.parse_iso(NOW_ISO)
IST = timedelta(hours=5, minutes=30)

LEDGER = """# ledger

| row-id | dispatched | spec accepted | PR | verdict | merged/blocked | notes |
| --- | --- | --- | --- | --- | --- | --- |
| P0-LOOP | 2026-09-08 13:18 | 2026-09-08 14:57 | #1 | PASS | ✅ MERGED `0f12e89` (squash) https://github.com/slang-coworkers/hermes-agent/pull/1 | rehearsal |
| LOOP-F35 | 2026-09-09 12:20 IST (to hermes-architect) | 2026-09-09 15:27 IST (round 1) | — | — | — | **Batch 1a of dispatch-plan.md** BUILD `nv-coworker-compose` |
| MEM-F44 | 2026-09-09 08:00 UTC | 2026-09-09 09:00 UTC | #9 | round 2/2 FAIL | — | Batch 1b wave 1; retention |
| OBS-F46 | 2026-09-09 10:00 UTC | — | — | — | — | Batch 1b wave 1 |
| COST-F29 | 2026-09-08 09:00 UTC | 2026-09-08 10:00 UTC | #11 | round 1/2 PASS | — | Batch 2 |
| GOV-F24 | 2026-09-08 09:00 UTC | 2026-09-08 10:00 UTC | #12 | APPROVE | — | Batch 2 |
| GOV-F25 | 2026-09-08 09:00 UTC | 2026-09-08 10:00 UTC | #13 | — | — | Batch 2 |
| OPS-F58.a | 2026-09-08 10:00 IST | 2026-09-08 11:00 IST | #7 | round 2/2 FAIL | blocked: STOP cap — test FAIL ×2 | capped |
| LOOP-F37 | 2026-09-07 09:00 UTC | 2026-09-07 10:00 UTC | #5 | APPROVE | merged 9abcdef0 — https://github.com/slang-coworkers/hermes-agent/pull/5 | done |
"""

ALERTS = """# Hermes autopilot alerts (newest first)

- 2026-09-09T20:30:00Z · OBS-F46 · dispatched 10h · no [Spec handoff] · nudged 1× (last 2026-09-09T16:00:00Z) · decision: re-dispatch or wait · PR #- · thread hermes-OBS-F46
- 2026-09-09T02:00:00Z · GOV-F25 · pr_open 3h · no hand-off · nudged 1× · decision: nudge · PR #13 · thread hermes-GOV-F25
- 2026-09-08T20:00:00Z · OPS-F58.a · blocked 0h · cap exhausted · nudged 0× · decision: re-spec or drop · PR #7 · thread hermes-OPS-F58.a
"""

PRS = [
    {"number": 9, "title": "feat(mem): retention [MEM-F44]", "state": "OPEN", "isDraft": True, "createdAt": "2026-09-09T13:05:00Z", "headRefOid": "aaaa111bbbb"},
    {"number": 11, "title": "feat(cost): caps [COST-F29]", "state": "OPEN", "isDraft": True, "createdAt": "2026-09-08T12:30:00Z"},
    {"number": 12, "title": "feat(gov): approvals [GOV-F24]", "state": "OPEN", "isDraft": True, "createdAt": "2026-09-08T11:00:00Z"},
    {"number": 13, "title": "feat(gov): roles [GOV-F25]", "state": "OPEN", "isDraft": True, "createdAt": "2026-09-09T01:00:00Z"},
    {"number": 5, "title": "feat(loop): compose [LOOP-F37]", "state": "MERGED", "isDraft": False, "createdAt": "2026-09-07T12:00:00Z"},
]


def sup(stage, clock, age, **kw):
    base = {"stage": stage, "stage_label": kw.pop("stage_label", stage), "clock_start": clock, "age_hours": age,
            "slo_status": "ok", "hold": None, "cost_hold": False, "pr": None, "test_rounds": [], "review_rounds": [],
            "action": "none", "target_role": None, "alert_line": None, "alert_kind": None}
    base.update(kw)
    return base


STATE = {
    "generated_at": "2026-09-09T20:47:00Z",
    "wip": {"limit": 4, "in_flight": 6, "free": 0},
    "config": {"wip": 4, "paused": False, "paused_rows": ["GOV-F25"]},
    "in_flight": ["LOOP-F35", "MEM-F44", "OBS-F46", "COST-F29", "GOV-F24", "GOV-F25"],
    "eligible_next": [{"id": "OPS-F58.b", "batch": "1b"}, {"id": "LOOP-F40", "batch": "2"}],
    "rows": {
        "LOOP-F35": {"state": "building", "batch": "1a", "disposition": "BUILD", "ledger": {"pr": None}},
        "MEM-F44": {"state": "building", "batch": "1b", "disposition": "CONFIGURE", "ledger": {"pr": 9}},
        "OBS-F46": {"state": "dispatched", "batch": "1b", "disposition": "CONFIGURE"},
        "COST-F29": {"state": "review", "batch": "2", "disposition": "CONFIGURE", "ledger": {"pr": 11}},
        "GOV-F24": {"state": "gate", "batch": "2", "disposition": "CONFIGURE", "ledger": {"pr": 12}},
        "GOV-F25": {"state": "pr_open", "batch": "2", "disposition": "CONFIGURE", "ledger": {"pr": 13}, "paused": True},
        "OPS-F58.a": {"state": "blocked", "batch": "1b", "disposition": "CONFIGURE", "ledger": {"pr": 7}},
        "LOOP-F37": {"state": "merged", "batch": "2", "disposition": "BUILD", "ledger": {"pr": 5}},
        "OPS-F58.b": {"state": "queued", "batch": "1b", "disposition": "CONFIGURE"},
        "LOOP-F40": {"state": "queued", "batch": "2", "disposition": "CONFIGURE"},
        "CH-F53": {"state": "deferred", "batch": "defer", "disposition": "DEFER"},
    },
    "supervise": {"rows": {
        # a ✓ (spec 09:57Z), b ▶ 9.0h: builder holds the row, no PR yet
        "LOOP-F35": sup("building", "2026-09-09T12:00:00Z", 9.0, slo_status="breached", action="nudge", target_role="hermes-builder", nudge_after_h=8.0),
        # tester FAIL round 2 (round 3 authorized), builder owes the new head
        "MEM-F44": sup("building", "2026-09-09T19:30:00Z", 1.5, pr=9, head="aaaa111",
                       test_rounds=[{"round": 1, "head": "0000001", "verdict": "FAIL", "ts": "2026-09-09T16:00:00Z"},
                                    {"round": 2, "head": "aaaa111", "verdict": "FAIL", "ts": "2026-09-09T19:30:00Z"}]),
        # tester active on round 1 after a PASS-less hand-off; the reviewer not started
        "COST-F29": sup("testing", "2026-09-09T18:00:00Z", 3.0, stage_label="testing(1)", round=1, pr=11, target_role="hermes-tester"),
        # at the gate, held on 1a; every role done
        "GOV-F24": sup("gate", "2026-09-09T14:00:00Z", 7.0, pr=12, hold="1a",
                       test_rounds=[{"round": 1, "head": "bbbb222", "verdict": "PASS", "ts": "2026-09-09T13:00:00Z"}],
                       review_rounds=[{"round": 1, "head": "bbbb222", "verdict": "APPROVE", "ts": "2026-09-09T14:00:00Z"}]),
        # paused: the builder's ▶ becomes ⏸
        "GOV-F25": sup("pr_open", "2026-09-09T01:00:00Z", 20.0, pr=13, hold="paused"),
        "OPS-F58.a": sup("blocked", None, None, pr=7, reason="cap: test FAIL x2, no round 3 authorized"),
        "LOOP-F37": sup("merged", None, None, pr=5, reason="fork MERGED"),
        # OBS-F46 has no supervisor row: ledger + queue only
    }},
    "actions": [],
    "alerts": [],
}


def parsed_ledger():
    return scorecard.parse_ledger(LEDGER, IST)["rows"]


def render(state=STATE, alerts_text=ALERTS, now=NOW, **kw):
    return abtr.render_abtr_markdown(state, parsed_ledger(), now, prs=PRS, alerts=scorecard.parse_alerts(alerts_text), **kw)


def table_rows(md: str) -> dict:
    rows = {}
    for line in md.splitlines():
        if line.startswith("| ") and not line.startswith("| row |"):
            cells = [c.strip() for c in line.strip().strip("|").split(" | ")]
            rows[cells[0]] = cells
    return rows


class CellsTest(unittest.TestCase):
    def setUp(self):
        self.md = render()
        self.rows = table_rows(self.md)

    def test_header_counts(self):
        head = self.md.splitlines()[0]
        self.assertEqual(head, "Hermes autopilot · 09-09 20:47Z · in flight 6/4 · merged 1 · blocked 1 · queued 2 · alerts 6h 1 · cards 24h ?")
        self.assertLessEqual(len(head), abtr.MAX_LINE)

    def test_header_cards_token(self):
        head = render(cards_24h=3).splitlines()[0]
        self.assertTrue(head.endswith(" · alerts 6h 1 · cards 24h 3"), head)
        self.assertLessEqual(len(head), abtr.MAX_LINE)
        self.assertIn(" · cards 24h 0", render(cards_24h=0).splitlines()[0])
        self.assertIn(" · cards 24h ?", render(cards_24h=None).splitlines()[0])   # no card dir reachable: unknown, not zero

    def test_building_row_a_done_b_active(self):
        _, batch, a, b, t, r, gate, note = self.rows["LOOP-F35"]
        self.assertEqual((batch, a, b, t, r, gate), ("1a", "✓ 09:57Z", "▶ 9.0h", "·", "·", "·"))
        self.assertEqual(note, "SLO building 9.0h > 8h: nudge hermes-builder")

    def test_tester_fail_round_2(self):
        _, _batch, a, b, t, r, gate, note = self.rows["MEM-F44"]
        self.assertEqual((a, b, t, r, gate), ("✓ 09:00Z", "▶ 1.5h", "✗ FAIL r2", "·", "·"))
        self.assertTrue(note.startswith("building · Batch 1b wave 1"), note)

    def test_testing_and_gate_and_paused(self):
        self.assertEqual(self.rows["COST-F29"][2:7], ["✓ 09-08 10:00Z", "✓ 09-08 12:30Z", "▶ 3.0h", "·", "·"])
        self.assertEqual(self.rows["GOV-F24"][2:7], ["✓ 09-08 10:00Z", "✓ 09-08 11:00Z", "✓ 13:00Z", "✓ 14:00Z", "⏸ 1a"])
        self.assertEqual(self.rows["GOV-F24"][7], "hold: 1a")
        self.assertEqual(self.rows["GOV-F25"][2:8], ["✓ 09-08 10:00Z", "⏸", "·", "·", "·", "paused"])

    def test_ledger_only_row_is_dispatched_with_an_alert_note(self):
        _, batch, a, b, t, r, gate, note = self.rows["OBS-F46"]
        self.assertEqual((batch, a, b, t, r, gate), ("1b", "▶ 11.0h", "·", "·", "·", "·"))
        self.assertEqual(note, "alert: dispatched 10h · no [Spec handoff]")

    def test_blocked_and_merged_are_compact(self):
        self.assertEqual(self.rows["OPS-F58.a"][2:7], ["✓", "✓", "✗ FAIL r2", "·", "✗ STOP cap — test FAIL ×2"])
        self.assertEqual(self.rows["OPS-F58.a"][7], "capped")   # the 2026-09-08 alert is older than 24 h
        self.assertEqual(self.rows["LOOP-F37"][2:8], ["✓", "✓", "✓", "✓", "✓ 9abcdef", ""])
        self.assertNotIn("P0-LOOP", self.rows)   # non-matrix row

    def test_order_in_flight_by_age_then_blocked_then_merged(self):
        self.assertEqual(list(self.rows), ["GOV-F25", "OBS-F46", "LOOP-F35", "GOV-F24", "COST-F29", "MEM-F44", "OPS-F58.a", "LOOP-F37"])

    def test_queued_line_and_width(self):
        lines = self.md.splitlines()
        self.assertEqual(lines[-1], "queued: 2 rows (next: OPS-F58.b, LOOP-F40)")
        self.assertLessEqual(max(len(line) for line in lines), 120)
        self.assertTrue(all(len(line) <= 110 for line in lines if line.startswith("| ")), [len(line) for line in lines])

    def test_deterministic_for_a_fixed_now(self):
        self.assertEqual(render(), render())
        self.assertEqual(render(), self.md)
        later = abtr.parse_iso("2026-09-10T03:00:00Z")
        other = render(now=later)
        self.assertNotEqual(other, self.md)
        self.assertIn("| OBS-F46 | 1b | ▶ 17.0h |", other)
        self.assertIn("✓ 09-09 09:57Z", other)   # dated once the stamp is not on now's date


class DegradedInputsTest(unittest.TestCase):
    def test_no_state_falls_back_to_the_ledger_and_the_plan_count(self):
        md = abtr.render_abtr_markdown({}, parsed_ledger(), NOW, prs=PRS, alerts=[], dispatchable=30)
        rows = table_rows(md)
        head = md.splitlines()[0]
        self.assertTrue(head.startswith(f"Hermes autopilot · {abtr.fmt_tick(NOW_ISO, NOW)} · in flight 6/3 · merged 1 · blocked 1 · queued 22 · alerts 6h 0 · cards 24h ?"), head)
        self.assertEqual(rows["MEM-F44"][2:7], ["✓ 09:00Z", "▶ 12.0h", "✗ FAIL r2", "·", "·"])   # verdict cell: round 2/2 FAIL -> building
        self.assertEqual(rows["GOV-F24"][2:7], ["✓ 09-08 10:00Z", "✓ 09-08 11:00Z", "✓", "✓", "▶ 35.0h"])   # APPROVE -> gate
        self.assertEqual(rows["COST-F29"][2:7], ["✓ 09-08 10:00Z", "✓ 09-08 12:30Z", "✓", "▶ 35.0h", "·"])   # PASS -> review
        self.assertEqual(rows["LOOP-F35"][2], "✓▶ 11.1h")   # spec seen 15:27 IST = 09:57Z, forward owed
        self.assertEqual(md.splitlines()[-1], "queued: 22 rows (next: none)")

    def test_empty_everything(self):
        md = abtr.render_abtr_markdown({}, {}, NOW)
        self.assertIn("in flight 0/3 · merged 0 · blocked 0 · queued 30 · alerts 6h 0", md.splitlines()[0])
        self.assertIn("no rows in the ledger or the state", md)
        self.assertLessEqual(max(len(line) for line in md.splitlines()), 120)

    def test_cost_hold_and_paused_flag_render_pause(self):
        st = json.loads(json.dumps(STATE))
        st["supervise"]["rows"]["COST-F29"].update(cost_hold=True, cost_hold_sessions=[{"role": "hermes-tester", "cost_status": "stopped"}])
        rows = table_rows(render(state=st))
        self.assertEqual(rows["COST-F29"][4], "⏸")
        self.assertEqual(rows["COST-F29"][7], "cost hold: hermes-tester stopped")

    def test_brief_is_header_in_flight_rows_and_link(self):
        brief = abtr.render_abtr_brief(STATE, parsed_ledger(), NOW, prs=PRS, alerts=scorecard.parse_alerts(ALERTS)).splitlines()
        self.assertEqual(brief[0], render().splitlines()[0])
        self.assertEqual(brief[1], "GOV-F25 | ✓ 09-08 10:00Z | ⏸ | · | ·")
        self.assertIn("LOOP-F35 | ✓ 09:57Z | ▶ 9.0h | · | ·", brief)
        self.assertIn("GOV-F24 | ✓ 09-08 10:00Z | ✓ 09-08 11:00Z | ✓ 13:00Z | ✓ 14:00Z | gate ⏸ 1a", brief)
        self.assertNotIn("OPS-F58.a", "\n".join(brief))
        self.assertEqual(brief[-1], "full table: /status/autopilot.md")
        self.assertLessEqual(max(len(line) for line in brief), 120)


class CliTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        (self.dir / "in").mkdir()
        (self.dir / "in" / "ledger.md").write_text(LEDGER)
        (self.dir / "in" / "alerts.md").write_text(ALERTS)
        (self.dir / "in" / "state.json").write_text(json.dumps(STATE))
        (self.dir / "in" / "prs.json").write_text(json.dumps(PRS))
        (self.dir / "in" / "config.json").write_text(json.dumps(STATE["config"]))

    def tearDown(self):
        self.tmp.cleanup()

    def run_cli(self, *extra):
        return subprocess.run([sys.executable, str(HERE / "scorecard.py"), "--dir", str(self.dir / "in"), "--now", NOW_ISO, *extra],
                              capture_output=True, text=True, check=False)

    def test_markdown_prints_and_writes_atomically(self):
        out = self.dir / "status" / "autopilot.md"   # parent does not exist yet
        proc = self.run_cli("--markdown", str(out))
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(proc.stdout, render())
        self.assertEqual(out.read_text(), render())
        self.assertEqual([p.name for p in out.parent.iterdir()], ["autopilot.md"])   # no tmp file left behind

    def test_brief_and_markdown_together_and_path_overrides(self):
        moved = self.dir / "elsewhere.md"
        (self.dir / "in" / "ledger.md").rename(moved)
        proc = self.run_cli("--ledger", str(moved), "--markdown", "--brief", str(self.dir / "tick-report.txt"))
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertTrue(proc.stdout.startswith(render()))
        self.assertTrue(proc.stdout.rstrip().endswith("full table: /status/autopilot.md"))
        self.assertEqual((self.dir / "tick-report.txt").read_text().splitlines()[0], render().splitlines()[0])

    def test_json_card_carries_both_and_text_card_is_unchanged(self):
        proc = self.run_cli("--json")
        card = json.loads(proc.stdout)
        self.assertEqual(card["abtr_markdown"], render())
        self.assertTrue(card["abtr_brief"].startswith("Hermes autopilot · "))
        text = self.run_cli().stdout
        self.assertTrue(text.startswith("HERMES AUTOPILOT CHECK"))
        self.assertNotIn("| row | batch |", text)


class HelpersTest(unittest.TestCase):
    def test_fmt_time_and_age(self):
        self.assertEqual(abtr.fmt_time("2026-09-09T09:57:00Z", NOW), "09:57Z")
        self.assertEqual(abtr.fmt_time("2026-09-08T23:59:00+00:00", NOW), "09-08 23:59Z")
        self.assertEqual(abtr.fmt_time("garbage", NOW), "")
        self.assertEqual(abtr.fmt_age(3.567), "3.6h")
        self.assertEqual(abtr.fmt_age(None), "?h")

    def test_ledger_rounds(self):
        self.assertEqual(abtr.ledger_rounds("test round 2/2 = FAIL"), ([{"round": 2, "verdict": "FAIL", "ts": None}], []))
        self.assertEqual(abtr.ledger_rounds("round 1/2 PASS; review round 1 REQUEST_CHANGES")[1], [{"round": 1, "verdict": "REQUEST_CHANGES", "ts": None}])
        self.assertEqual(abtr.ledger_rounds("—"), ([], []))

    def test_note_escapes_pipes_and_truncates(self):
        self.assertEqual(abtr.clean_text("a | b **c** `d`"), "a \\| b c d")
        self.assertEqual(abtr.trunc("abcdefgh", 5), "abcd…")
        self.assertEqual(abtr.trunc("abc", 5), "abc")


if __name__ == "__main__":
    unittest.main()
