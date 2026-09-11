#!/usr/bin/env python3
"""Tests for hermes_queue.py, the dispatch-tick core (docs/hermes-port/autopilot.md §2.2, §4).

Real fixtures: the box's ledger (fixtures/ledger.md: P0-LOOP merged, LOOP-F35 in flight) and
the repo's dispatch-plan.md + gap-matrix.md. Synthetic ledgers pin the WIP, gating and
never-twice rules. Run: python3 -m unittest ops/nemoclaw-coworkers/autopilot/test_hermes_queue.py
"""

from __future__ import annotations

import hashlib
import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import hermes_queue as hq

DOCS = HERE.parents[2] / "docs" / "hermes-port"
PLAN = (DOCS / "dispatch-plan.md").read_text(encoding="utf-8")
MATRIX = (DOCS / "gap-matrix.md").read_text(encoding="utf-8")
LEDGER = (HERE / "fixtures" / "ledger.md").read_text(encoding="utf-8")
NOW = "2026-09-09T12:00:00Z"

HEADER = (
    "# Hermes PORT — work-item ledger\n\n"
    "| row-id | dispatched | spec accepted | PR | verdict | merged/blocked | notes |\n"
    "| --- | --- | --- | --- | --- | --- | --- |\n"
)
BATCH2 = ("LOOP-F37", "GOV-F24", "GOV-F25", "COST-F29", "COST-F30", "LOOP-F40")

# ledger.md's second table: criteria one row deferred onto another (the LOOP-F35 "AC-5 to P4" gap, done right).
CARRIED = (
    "\n## Carried criteria\n\n"
    "| criterion | from row | to row | reason | decided | status |\n"
    "| --- | --- | --- | --- | --- | --- |\n"
    "| AC-LOOP-F35-5 | LOOP-F35 | LOOP-F37 | the veto half needs the gates plugin; compose only renders the key | operator 2026-09-10 | open |\n"
    "| AC-LOOP-F35-6 | LOOP-F35 | ISO-F13 | mount set is ISO-F13's deliverable \\| rendered, not policed | msg 4242 2026-09-10 | covered (#12) |\n"
    "| AC-LOOP-F35-7 | LOOP-F35 | MEM-F44 | superseded by the compose render | operator 2026-09-09 | dropped (superseded) |\n"
)

# upstream-asks.md: core-change candidates the plugin surface cannot absorb (UA-1 is the real bare-`hermes` argv[0] case).
UPSTREAM_ASKS = (
    "# Upstream asks\n\nCore-change candidates the plugin surface cannot absorb.\n\n"
    "## Upstream asks\n\n"
    "| id | source row | citation | ask | disposition | owner | updated |\n"
    "| --- | --- | --- | --- | --- | --- | --- |\n"
    "| UA-1 | LOOP-F35 | /workspace/extra/hermes-release/tools/bot_mode_dm.py:316 | `bot_mode_dm.py` spawns bare `hermes` as argv[0]; a venv install has no `hermes` on PATH | bypassed (wrapper on PATH in the fixture, not filed) | orchestrator | 2026-09-10 |\n"
    "| UA-2 | LOOP-F37 | /workspace/extra/hermes-release/hermes_cli/plugins.py:12 | plugin load hook must see `name|alias` pairs | open | — | 2026-09-10 |\n"
    "| UA-3 | GOV-F27 | /workspace/extra/hermes-release/gateway/veto.py:40 | veto set must be enumerable | filed (https://github.com/NousResearch/hermes-agent/issues/999) | human | 2026-09-11 |\n"
)


def ledger(rows: list[dict]) -> str:
    out = HEADER
    for r in rows:
        out += (
            f"| {r['id']} | {r.get('dispatched', '2026-09-09 10:00Z (to hermes-architect, thread `hermes-' + r['id'] + '`)')} "
            f"| {r.get('spec', '—')} | {r.get('pr', '—')} | {r.get('verdict', '—')} | {r.get('outcome', '—')} "
            f"| {r.get('notes', 'n')} |\n"
        )
    return out


def merged_row(rid: str, pr: int = 9) -> dict:
    return {
        "id": rid,
        "spec": "2026-09-09 11:00Z",
        "pr": f"#{pr} (draft)",
        "verdict": "round 1/2 = PASS; APPROVE (round 1)",
        "outcome": f"✅ MERGED `abcdef1` (squash) into `release/v2026.8.31-e2e-fixed` — https://github.com/slang-coworkers/hermes-agent/pull/{pr}",
    }


def state(ledger_text: str, config: dict | None = None, prior: dict | None = None) -> dict:
    return hq.build_state(PLAN, MATRIX, ledger_text, config=config, prior_state=prior, now=NOW)


class PlanParse(unittest.TestCase):
    """§4: the parse reproduces the plan's coverage check from the plan file itself."""

    def setUp(self):
        self.plan = hq.parse_plan(PLAN)
        self.matrix = hq.parse_matrix(MATRIX)
        self.cov = hq.coverage_check(self.plan, self.matrix)

    def test_coverage_30_16_11_4_equals_61(self):
        self.assertTrue(self.cov["ok"], self.cov["problems"])
        self.assertEqual(self.cov["by_batch"], {"1a": 1, "1b": 18, "2": 6, "3": 4, "4": 1})
        self.assertEqual((self.cov["dispatched"], self.cov["adopt"], self.cov["merge"], self.cov["defer"]), (30, 16, 11, 4))
        self.assertEqual(self.cov["total"], 61)
        self.assertEqual(self.cov["matrix_rows"], 61)

    def test_waves_and_attachments(self):
        rows = self.plan["rows"]
        self.assertEqual([rows[r]["wave"] for r in ("MEM-F44", "OPS-F58.a", "OBS-F46")], [1, 1, 1])
        self.assertEqual(rows["ISO-F16"]["wave"], 5)
        self.assertEqual(rows["ISO-F17"]["attaches_to"], "P6-fleet")
        self.assertEqual(rows["OBS-F45"]["attaches_to"], "P2")
        self.assertEqual(rows["A2A-F20"]["attaches_to"], "P5-rooms-veto")

    def test_carries_bullets_and_p8_owners(self):
        self.assertEqual(self.plan["carries"]["LOOP-F35"], ["LOOP-F36", "SELF-F54", "SELF-F56"])
        self.assertEqual(len(self.plan["carries"]["LOOP-F37"]), 7)
        self.assertEqual(self.plan["carries"]["GOV-F25"], ["OBS-F48"])
        self.assertIn("LOOP-F37", self.plan["upstream_owners"])
        self.assertIn("MEM-F44", self.plan["upstream_owners"])
        # "SELF-F55 (SELF-F57 carries it)" -> the owner is the first id in the cell
        self.assertIn("SELF-F55", self.plan["upstream_owners"])
        self.assertNotIn("SELF-F57", self.plan["upstream_owners"])

    def test_dotted_ids_are_their_own_rows(self):
        self.assertEqual(self.matrix["rows"]["OPS-F58"]["disposition"], "ADOPT")
        self.assertEqual(self.matrix["rows"]["OPS-F58.a"]["disposition"], "CONFIGURE")
        self.assertEqual(self.matrix["rows"]["SELF-F57.a"]["disposition"], "DEFER")
        self.assertEqual(self.plan["rows"]["OPS-F58.a"]["batch"], "1b")
        self.assertEqual(self.plan["rows"]["OPS-F58"]["batch"], "adopt")

    def test_coverage_fails_when_a_row_is_dropped(self):
        broken = PLAN.replace("| MEM-F44 | Transcript retention", "| MEM-F44x | Transcript retention")
        cov = hq.coverage_check(hq.parse_plan(broken), self.matrix)
        self.assertFalse(cov["ok"])
        self.assertTrue(any("MEM-F44" in p for p in cov["problems"]), cov["problems"])


class MatrixParse(unittest.TestCase):
    def setUp(self):
        self.rows = hq.parse_matrix(MATRIX)["rows"]

    def test_raw_pipes_in_name_do_not_shift_columns(self):
        r = self.rows["RT-F02"]  # "engage modes (pattern|mention|mention-sticky)"
        self.assertEqual(r["disposition"], "CONFIGURE")
        self.assertEqual(r["outcomes"], ["O3", "O7"])
        self.assertFalse(r["esc"])
        r = self.rows["ISO-F15"]
        self.assertEqual((r["disposition"], r["esc"], r["outcomes"]), ("CONFIGURE", True, ["O4"]))

    def test_merge_and_defer_dispositions(self):
        self.assertEqual(self.rows["ISO-F10"]["disposition"], "MERGE")
        self.assertEqual(self.rows["ISO-F10"]["merge_into"], "LOOP-F37")
        self.assertEqual(self.rows["OBS-F48"]["merge_into"], "GOV-F25")
        self.assertEqual(sorted(r for r, v in self.rows.items() if v["disposition"] == "DEFER"), ["CH-F53", "RT-F04", "RT-F06", "SELF-F57.a"])
        self.assertEqual(self.rows["RT-F04"]["outcomes"], [])
        self.assertTrue(self.rows["LOOP-F35"]["design_note"].startswith("BUILD"))


class LedgerParse(unittest.TestCase):
    """§2.2 source A on the real box ledger plus the cell rules."""

    def setUp(self):
        self.led = hq.parse_ledger(LEDGER)

    def test_real_ledger_rows_and_other_rows(self):
        self.assertTrue(self.led["header_ok"])
        self.assertEqual(list(self.led["rows"]), ["LOOP-F35"])
        self.assertEqual(sorted(self.led["other_rows"]), ["P0-LOOP", "P1-HELLO", "P2-E2E-BASELINE", "P2-PREFLIGHT"])
        self.assertEqual(self.led["duplicates"], [])

    def test_loop_f35_in_flight_at_spec_handoff(self):
        e = self.led["rows"]["LOOP-F35"]
        self.assertEqual(e["dispatched_at"], "2026-09-09T06:50:00Z")  # 12:20 IST
        self.assertEqual(e["spec_accepted_at"], "2026-09-09T09:57:00Z")
        self.assertIsNone(e["pr"])
        self.assertIsNone(e["outcome"])
        self.assertFalse(e["verdict"]["tester_pass"])
        self.assertEqual(hq.ledger_state(e), ("spec_handoff", None))

    def test_p0_loop_merged_token_anywhere_in_cell(self):
        e = self.led["other_rows"]["P0-LOOP"]
        self.assertEqual(e["outcome"], "merged")
        self.assertEqual(e["merge_sha"], "0f12e89")
        self.assertTrue(e["pr_url"].endswith("/pull/1"))
        self.assertEqual(e["pr"], 1)

    def test_outcome_cell_rules(self):
        self.assertEqual(hq.parse_outcome_cell("blocked: P3 — head moved")["outcome"], "gate_red")
        self.assertEqual(hq.parse_outcome_cell("blocked: P3 — head moved")["gate_red"], "P3")
        self.assertEqual(hq.parse_outcome_cell("blocked: STOP cap - FAIL x2")["outcome"], "blocked")
        self.assertIsNone(hq.parse_outcome_cell("the merged rows ride the target")["outcome"])  # no sha, no url
        self.assertEqual(hq.parse_outcome_cell("blocked: P2 — x; then ✅ MERGED `abc1234` (squash)")["outcome"], "merged")
        self.assertEqual(hq.parse_outcome_cell("merged `abc1234`; later blocked: STOP reverted")["outcome"], "blocked")
        self.assertEqual(hq.parse_outcome_cell("—")["outcome"], None)

    def test_empty_cell_and_timestamp_rules(self):
        for cell in ("", "—", "-", "–", "n/a — preflight task", "**—**"):
            self.assertTrue(hq.is_empty_cell(cell), cell)
        self.assertFalse(hq.is_empty_cell("2026-09-09 12:20 IST (to hermes-architect)"))
        self.assertEqual(hq.first_timestamp("x 2026-09-09 06:35Z y", 330), "2026-09-09T06:35:00Z")
        self.assertEqual(hq.first_timestamp("2026-09-08 13:18 (to hermes-architect)", 330), "2026-09-08T07:48:00Z")
        self.assertEqual(hq.first_timestamp("2026-09-08 13:18 +02:00", 330), "2026-09-08T11:18:00Z")
        self.assertIsNone(hq.first_timestamp("no stamp", 330))

    def test_columns_located_by_header_not_position(self):
        text = (
            "| notes | merged/blocked | PR | row-id | dispatched | spec accepted | verdict |\n"
            "| --- | --- | --- | --- | --- | --- | --- |\n"
            "| n | merged `abc1234` /pull/4 | #4 | MEM-F44 | 2026-09-09 10:00Z | 2026-09-09 11:00Z | round 1/2 = PASS |\n"
        )
        e = hq.parse_ledger(text)["rows"]["MEM-F44"]
        self.assertEqual(e["pr"], 4)
        self.assertEqual(e["outcome"], "merged")
        self.assertEqual(e["dispatched_at"], "2026-09-09T10:00:00Z")

    def test_raw_pipe_in_notes_folds_into_last_column(self):
        text = ledger([{"id": "MEM-F44", "pr": "#4", "notes": "a | b | c"}])
        e = hq.parse_ledger(text)["rows"]["MEM-F44"]
        self.assertEqual(e["pr"], 4)
        self.assertIsNone(e["outcome"])
        self.assertEqual(e["notes_len"], len("a|b|c"))  # cells are stripped, then re-joined on the pipe

    def test_duplicate_rows_last_wins_and_flagged(self):
        text = ledger([{"id": "MEM-F44"}, {"id": "MEM-F44", "outcome": "blocked: STOP dup"}])
        led = hq.parse_ledger(text)
        self.assertEqual(led["duplicates"], ["MEM-F44"])
        self.assertEqual(led["rows"]["MEM-F44"]["outcome"], "blocked")
        st = state(text)
        self.assertTrue(any(a["kind"] == "ledger-duplicate" for a in st["alerts"]))

    def test_verdict_cell_pass_detection_ignores_ac_rows(self):
        v = hq.parse_verdict_cell("test round 2/2 = FAIL — AC-1 PASS, **AC-2 PASS**, AC-3 FAIL")
        self.assertFalse(v["tester_pass"])
        self.assertTrue(v["fail_round2"])
        self.assertTrue(hq.parse_verdict_cell("round 1/2 = PASS")["tester_pass"])
        self.assertTrue(hq.parse_verdict_cell("[Test Report] slang-coworkers/hermes-agent#3 (round 1/2, head abc1234) PASS")["tester_pass"])


class LedgerIdSpelling(unittest.TestCase):
    """A decorated row-id cell must not free the row's WIP slot (the double-dispatch probe)."""

    def test_probe_decorated_1a_row_stays_in_flight(self):
        st = state(ledger([{"id": "LOOP-F35 (1a)"}]))
        self.assertEqual(st["in_flight"], ["LOOP-F35"])
        self.assertEqual(st["wip"], {"limit": 3, "in_flight": 1, "free": 2, "build_in_flight": True})
        self.assertNotIn("LOOP-F35", [e["id"] for e in st["eligible_next"]])
        self.assertEqual(st["rows"]["LOOP-F35"]["ledger"]["id_cell_raw"], "LOOP-F35 (1a)")
        self.assertEqual(st["sources"]["ledger"]["other_rows"], [])
        self.assertIn(("ledger-id-spelling", "LOOP-F35"), [(a["kind"], a["row"]) for a in st["alerts"]])
        detail = next(a["detail"] for a in st["alerts"] if a["kind"] == "ledger-id-spelling")
        self.assertIn("LOOP-F35 (1a)", detail)
        self.assertEqual(st["sources"]["ledger"]["id_spelling"], [{"row": "LOOP-F35", "cell": "LOOP-F35 (1a)", "ids": ["LOOP-F35"]}])

    def test_every_spelling_from_the_finding_is_read(self):
        led = ledger([
            {"id": "[LOOP-F35]"},
            {"id": "MEM-F44 \u2014 compose"},  # em dash note
            {"id": "LOOP\u2011F37"},  # U+2011 non-breaking hyphen
            {"id": "`OBS-F46` (1b)"},
        ])
        parsed = hq.parse_ledger(led)
        self.assertEqual(parsed["order"], ["LOOP-F35", "MEM-F44", "LOOP-F37", "OBS-F46"])
        self.assertEqual(parsed["other_rows"], {})
        self.assertEqual([s["row"] for s in parsed["spelling"]], ["LOOP-F35", "MEM-F44", "LOOP-F37", "OBS-F46"])
        st = state(led)
        self.assertEqual(st["wip"]["in_flight"], 4)
        self.assertEqual(st["eligible_next"], [])

    def test_bare_and_bold_ids_raise_no_spelling_alert(self):
        self.assertEqual(hq.parse_ledger(LEDGER)["spelling"], [])
        self.assertFalse(any(a["kind"] == "ledger-id-spelling" for a in state(LEDGER)["alerts"]))
        parsed = hq.parse_ledger(ledger([{"id": "**LOOP-F35**"}, {"id": "`MEM-F44`"}]))
        self.assertEqual(parsed["order"], ["LOOP-F35", "MEM-F44"])
        self.assertEqual(parsed["spelling"], [])
        self.assertNotIn("id_cell_raw", parsed["rows"]["LOOP-F35"])

    def test_dotted_id_in_a_decorated_cell_is_not_swallowed(self):
        parsed = hq.parse_ledger(ledger([{"id": "[OPS-F58.a]"}]))
        self.assertEqual(parsed["order"], ["OPS-F58.a"])
        self.assertNotIn("OPS-F58", parsed["rows"])

    def test_two_ids_in_one_cell_stay_a_non_matrix_row_and_alert(self):
        led = ledger([{"id": "LOOP-F35 / LOOP-F36"}])
        parsed = hq.parse_ledger(led)
        self.assertEqual(parsed["order"], [])
        self.assertIn("LOOP-F35 / LOOP-F36", parsed["other_rows"])
        st = state(led)
        alert = next(a for a in st["alerts"] if a["kind"] == "ledger-id-spelling")
        self.assertIsNone(alert["row"])
        self.assertIn("names 2 ids (LOOP-F35, LOOP-F36)", alert["detail"])
        self.assertEqual(st["in_flight"], [])

    def test_decorated_and_bare_rows_for_one_id_are_a_duplicate(self):
        st = state(ledger([{"id": "LOOP-F35"}, {"id": "LOOP-F35 (1a)"}]))
        kinds = [(a["kind"], a["row"]) for a in st["alerts"]]
        self.assertIn(("ledger-duplicate", "LOOP-F35"), kinds)
        self.assertIn(("ledger-id-spelling", "LOOP-F35"), kinds)
        self.assertEqual(st["wip"]["in_flight"], 1)

    def test_decorated_unknown_id_raises_both_alerts(self):
        st = state(ledger([{"id": "[FOO-F99]"}]))
        kinds = [(a["kind"], a["row"]) for a in st["alerts"]]
        self.assertIn(("ledger-unknown-id", "FOO-F99"), kinds)
        self.assertIn(("ledger-id-spelling", "FOO-F99"), kinds)


class PromptRecheck(unittest.TestCase):
    """dispatch-cron.sh's per-row ledger re-check (LEDGER_ROW_RE): the grep must see every spelling
    the queue reads (bare, bold, bracketed, a trailing note) and must not let OPS-F58 match OPS-F58.a."""

    def setUp(self):
        text = (HERE / "dispatch-cron.sh").read_text(encoding="utf-8")
        m = re.search(r"^LEDGER_ROW_RE='([^']+)'", text, re.MULTILINE)
        self.assertIsNotNone(m, "LEDGER_ROW_RE not found in dispatch-cron.sh")
        self.pattern = m.group(1)

    def hits(self, rid: str, line: str) -> bool:
        # the script substitutes <ID> with the id, dots escaped (OPS-F58.a)
        pat = self.pattern.replace("<ID>", rid.replace(".", "\\."))
        p = subprocess.run(["grep", "-E", pat], input=line + "\n", capture_output=True, text=True, check=False)
        return p.returncode == 0

    def test_grep_matches_every_spelling_the_queue_reads(self):
        for cell in ("LOOP-F35", "**LOOP-F35**", "[LOOP-F35]", "LOOP-F35 (1a)", "LOOP-F35 \u2014 compose", "`LOOP-F35`"):
            self.assertTrue(self.hits("LOOP-F35", f"| {cell} | 2026-09-09 10:00Z | - | - | - | - | n |"), cell)
        self.assertTrue(self.hits("LOOP-F35", "|LOOP-F35| x |"))
        self.assertTrue(self.hits("OPS-F58.a", "| OPS-F58.a | 2026-09-08 10:00 IST | - | #7 | - | - | n |"))

    def test_grep_does_not_match_siblings_or_mentions(self):
        self.assertFalse(self.hits("OPS-F58", "| OPS-F58.a | 2026-09-08 10:00 IST | - | #7 | - | - | n |"))
        self.assertFalse(self.hits("LOOP-F35", "| LOOP-F350 | x |"))
        self.assertFalse(self.hits("LOOP-F35", "| XLOOP-F35 | x |"))
        self.assertFalse(self.hits("LOOP-F35", "| P0-LOOP | 2026-09-08 (thread hermes-P0-LOOP) | LOOP-F35 named in notes | - | - | - | n |"))


class RealState(unittest.TestCase):
    """The box ledger as shipped: P0-LOOP merged, LOOP-F35 in flight, nothing else eligible."""

    def setUp(self):
        self.st = state(LEDGER)

    def test_in_flight_and_wip(self):
        self.assertEqual(self.st["in_flight"], ["LOOP-F35"])
        self.assertEqual(self.st["merged"], [])
        self.assertEqual(self.st["blocked"], [])
        self.assertEqual(self.st["wip"], {"limit": 3, "in_flight": 1, "free": 2, "build_in_flight": True})
        self.assertEqual(self.st["rows"]["LOOP-F35"]["state"], "spec_handoff")

    def test_nothing_eligible_until_1a_first_pass(self):
        self.assertTrue(self.st["gating"]["batch0_merged"])
        self.assertFalse(self.st["gating"]["1a_first_pass"])
        self.assertEqual(self.st["eligible_next"], [])
        self.assertEqual([q["id"] for q in self.st["next_queue"]], ["MEM-F44", "OPS-F58.a", "OBS-F46"])
        self.assertEqual(self.st["next_queue"][0]["blocked_by"], ["1a_first_pass"])
        self.assertEqual(self.st["alerts"], [])

    def test_terminal_dispositions(self):
        self.assertEqual(self.st["rows"]["RT-F04"]["state"], "deferred")
        self.assertEqual(self.st["rows"]["ISO-F10"]["state"], "carried")
        self.assertEqual(self.st["rows"]["ISO-F10"]["merge_into"], "LOOP-F37")
        self.assertEqual(self.st["rows"]["LOOP-F35"]["carries"], ["LOOP-F36", "SELF-F54", "SELF-F56"])
        self.assertTrue(self.st["rows"]["LOOP-F37"]["upstream_ask"])
        self.assertTrue(self.st["rows"]["GOV-F27"]["upstream_ask"])  # esc = Y
        self.assertFalse(self.st["rows"]["LOOP-F35"]["upstream_ask"])

    def test_plan_hash_pinned(self):
        self.assertEqual(self.st["plan_sha256"], hashlib.sha256(PLAN.encode()).hexdigest())
        self.assertTrue(self.st["plan_ok"])
        st = state(LEDGER, config={"plan_sha256": "0" * 64})
        self.assertFalse(st["plan_ok"])
        self.assertEqual(st["dispatch_paused"], "plan-changed: hashes or coverage check")
        self.assertTrue(any(a["kind"] == "plan-changed" for a in st["alerts"]))


class QueueRules(unittest.TestCase):
    """§4.1 WIP, §4.2 order and gates, §8 never twice."""

    def test_1a_first_pass_opens_1b_wave_1(self):
        st = state(ledger([{"id": "LOOP-F35", "spec": "2026-09-09 11:00Z", "pr": "#2 (draft)", "verdict": "round 1/2 = PASS"}]))
        self.assertTrue(st["gating"]["1a_first_pass"])
        self.assertFalse(st["gating"]["1a_merged"])
        self.assertEqual(st["rows"]["LOOP-F35"]["state"], "review")
        self.assertEqual(st["wip"]["free"], 2)
        self.assertEqual([e["id"] for e in st["eligible_next"]], ["MEM-F44", "OPS-F58.a"])
        self.assertEqual(st["eligible_next"][0]["batch"], "1b")
        self.assertIn("wave 1", st["eligible_next"][0]["reason"])

    def test_wip_full_nothing_eligible(self):
        st = state(ledger([
            {"id": "LOOP-F35", "spec": "2026-09-09 11:00Z", "pr": "#2", "verdict": "round 1/2 = PASS"},
            {"id": "MEM-F44"},
            {"id": "OPS-F58.a"},
        ]))
        self.assertEqual(st["wip"]["in_flight"], 3)
        self.assertEqual(st["wip"]["free"], 0)
        self.assertEqual(st["eligible_next"], [])
        self.assertEqual(st["queue"]["eligible"][0], "OBS-F46")  # still queued, just no slot

    def test_wip_from_config(self):
        st = state(ledger([{"id": "LOOP-F35", "verdict": "round 1/2 = PASS", "pr": "#2"}]), config={"wip": 1})
        self.assertEqual(st["wip"], {"limit": 1, "in_flight": 1, "free": 0, "build_in_flight": True})
        self.assertEqual(st["eligible_next"], [])

    def test_1a_merged_build_lane_puts_loop_f37_first(self):
        st = state(ledger([merged_row("LOOP-F35", 2)]))
        self.assertTrue(st["gating"]["1a_merged"])
        self.assertEqual(st["merged"], ["LOOP-F35"])
        self.assertEqual(st["rows"]["LOOP-F36"]["state"], "merged")  # carried by LOOP-F35
        self.assertEqual(st["wip"]["free"], 3)
        self.assertEqual([e["id"] for e in st["eligible_next"]], ["LOOP-F37", "MEM-F44", "OPS-F58.a"])
        self.assertIn("BUILD lane", st["eligible_next"][0]["reason"])

    def test_build_lane_only_when_no_build_in_flight(self):
        st = state(ledger([merged_row("LOOP-F35", 2), {"id": "LOOP-F37"}]))
        self.assertTrue(st["wip"]["build_in_flight"])
        self.assertEqual([e["id"] for e in st["eligible_next"]], ["MEM-F44", "OPS-F58.a"])

    def test_blocked_row_does_not_count_toward_wip(self):
        st = state(ledger([
            merged_row("LOOP-F35", 2),
            {"id": "MEM-F44", "outcome": "blocked: STOP cap - test FAIL x2"},
            {"id": "OPS-F58.a"},
        ]))
        self.assertEqual(st["blocked"], ["MEM-F44"])
        self.assertEqual(st["in_flight"], ["OPS-F58.a"])
        self.assertEqual(st["wip"]["free"], 2)
        self.assertNotIn("MEM-F44", [e["id"] for e in st["eligible_next"]])

    def test_gate_red_row_stays_in_flight(self):
        st = state(ledger([merged_row("LOOP-F35", 2), {"id": "MEM-F44", "pr": "#3", "verdict": "APPROVE (round 1)", "outcome": "blocked: P3 — head moved — new tester round"}]))
        self.assertEqual(st["rows"]["MEM-F44"]["state"], "building")
        self.assertEqual(st["rows"]["MEM-F44"]["gate_red"], "P3")
        self.assertIn("MEM-F44", st["in_flight"])

    def test_cap_exhausted_by_count_unless_round3_authorized(self):
        row = {"id": "MEM-F44", "pr": "#3", "verdict": "round 1/2 = FAIL; round 2/2 = FAIL"}
        st = state(ledger([merged_row("LOOP-F35", 2), row]))
        self.assertEqual(st["rows"]["MEM-F44"]["state"], "blocked")
        st = state(ledger([merged_row("LOOP-F35", 2), row]), config={"authorize_round": {"MEM-F44": "environmental"}})
        self.assertEqual(st["rows"]["MEM-F44"]["state"], "building")

    def test_never_dispatch_twice(self):
        led = ledger([merged_row("LOOP-F35", 2), {"id": "MEM-F44"}])
        prior = {"rows": {"OPS-F58.a": {"dispatched_at": "2026-09-09T11:30:00Z"}}}
        st = state(led, config={"paused_rows": ["OBS-F46"]}, prior=prior)
        ids = [e["id"] for e in st["eligible_next"]]
        self.assertNotIn("MEM-F44", ids)  # ledger row
        self.assertNotIn("OPS-F58.a", ids)  # state.json bookkeeping, ledger not caught up
        self.assertNotIn("OBS-F46", ids)  # paused_rows
        self.assertEqual(st["rows"]["OPS-F58.a"]["state"], "dispatched")
        self.assertIn("OPS-F58.a", st["in_flight"])
        self.assertEqual(st["wip"]["in_flight"], 2)
        self.assertEqual(len(ids), 1)
        self.assertEqual(ids[0], "LOOP-F37")

    def test_defer_and_merge_rows_never_eligible_and_flag_plan_violation(self):
        st = state(ledger([merged_row("LOOP-F35", 2), {"id": "RT-F04"}, {"id": "ISO-F10"}]))
        eligible = set(st["queue"]["eligible"]) | {q["id"] for q in st["queue"]["waiting"]}
        for rid in ("RT-F04", "RT-F06", "CH-F53", "SELF-F57.a", "ISO-F10", "LOOP-F36", "OBS-F48"):
            self.assertNotIn(rid, eligible)
        kinds = [(a["kind"], a["row"]) for a in st["alerts"]]
        self.assertIn(("plan-violation", "RT-F04"), kinds)
        self.assertIn(("plan-violation", "ISO-F10"), kinds)

    def test_batch3_needs_batch2_merged_and_podman_box(self):
        rows = [merged_row("LOOP-F35", 2)] + [merged_row(r, i + 10) for i, r in enumerate(BATCH2)]
        st = state(ledger(rows))
        self.assertTrue(st["gating"]["batch2_merged"])
        waiting = {w["id"]: w["blocked_by"] for w in st["queue"]["waiting"]}
        self.assertEqual(waiting["CRED-F28"], ["podman_box"])
        self.assertTrue(any(a["kind"] == "podman-box-needed" for a in st["alerts"]))
        self.assertIn("A2A-F21", st["queue"]["eligible"])
        self.assertIn("A2A-F20", st["queue"]["eligible"])  # adopt @ P5
        self.assertEqual(waiting["ISO-F17"], ["batch3_merged", "batch4_merged"])
        st = state(ledger(rows), config={"podman_box": True})
        self.assertEqual(st["eligible_next"][0]["id"], "CRED-F28")  # BUILD lane, no BUILD in flight
        self.assertNotIn("podman-box-needed", [a["kind"] for a in st["alerts"]])

    def test_waive_counts_as_merged_for_gating(self):
        st = state(ledger([merged_row("LOOP-F35", 2)]), config={"waive": list(BATCH2)})
        self.assertTrue(st["gating"]["batch2_merged"])
        self.assertIn("A2A-F21", st["queue"]["eligible"])

    def test_paused_config_stops_dispatch_but_keeps_queue(self):
        st = state(ledger([merged_row("LOOP-F35", 2)]), config={"paused": True})
        self.assertEqual(st["eligible_next"], [])
        self.assertEqual(st["dispatch_paused"], "config.paused")
        self.assertEqual(st["queue"]["eligible"][0], "LOOP-F37")

    def test_dispatch_texts(self):
        st = state(ledger([merged_row("LOOP-F35", 2)]))
        by_id = {e["id"]: e for e in st["eligible_next"]}
        t = by_id["LOOP-F37"]["dispatch_text"]
        self.assertTrue(t.startswith("Dispatch LOOP-F37: Critique gate + chain-routing gate."))
        self.assertIn("disposition BUILD", t)
        self.assertIn("AC-GOV-F22, AC-GOV-F26, AC-LOOP-F38, AC-A2A-F18, AC-A2A-F19, AC-CH-F51, AC-ISO-F10", t)
        self.assertIn("title suffix [LOOP-F37]", t)
        self.assertIn("Upstream ask:", t)
        self.assertIn("base release/v2026.8.31-e2e-fixed", t)
        self.assertEqual(by_id["MEM-F44"]["thread_id"], "hermes-MEM-F44")
        self.assertEqual(by_id["MEM-F44"]["dashboard_line"], "Dispatched MEM-F44 to hermes-architect (autopilot, batch 1b)")
        self.assertIn("every id it carries: none", by_id["MEM-F44"]["dispatch_text"])
        adopt = hq.dispatch_text("OBS-F45", st["rows"]["OBS-F45"], hq.load_config(None))
        self.assertTrue(adopt.startswith("Adopt OBS-F45: Dashboard"))
        self.assertIn("attaches to P2", adopt)
        self.assertNotIn("Upstream ask", hq.dispatch_text("MEM-F41", st["rows"]["MEM-F41"], hq.load_config(None)))
        # An adopt row with esc = Y (COST-F31) carries the ask without the plugin-only wording.
        cost = hq.dispatch_text("COST-F31", st["rows"]["COST-F31"], hq.load_config(None))
        self.assertTrue(cost.startswith("Adopt COST-F31:"))
        self.assertIn("Upstream ask:", cost)
        self.assertNotIn("plugin-only", cost)
        self.assertIn("no plugin", cost)

    def test_orchestrator_text_wraps_the_architect_text_for_the_cron_post(self):
        """dispatch-cron.sh POSTs to the Orchestrator's inbox on hermes-<ID>, so the entry also carries
        the Orchestrator-facing steps (re-check, ledger row, forward verbatim) around the §4.4 text."""
        st = state(ledger([merged_row("LOOP-F35", 2)]))
        by_id = {e["id"]: e for e in st["eligible_next"]}
        e = by_id["LOOP-F37"]
        o = e["orchestrator_text"]
        self.assertTrue(o.startswith("Autopilot dispatch LOOP-F37 (BUILD, batch 2): Critique gate + chain-routing gate."))
        self.assertIn("| LOOP-F37 | <stamp> (to hermes-architect, thread `hermes-LOOP-F37`) |", o)
        self.assertIn("carries AC-GOV-F22, AC-GOV-F26", o)
        self.assertIn('send_message(to="hermes-architect", thread_id="hermes-LOOP-F37"', o)
        self.assertTrue(o.endswith("\n----\n" + e["dispatch_text"]), "the architect text is the tail, verbatim")
        self.assertEqual(o.count("\n----\n"), 1)
        self.assertNotEqual(o[0], "[", "never a marker-prefixed fresh message")
        m = by_id["MEM-F44"]["orchestrator_text"]
        self.assertIn("(CONFIGURE, batch 1b)", m)
        self.assertIn("carries none |", m)

    def test_unreadable_ledger_pauses_dispatch(self):
        st = state("")
        self.assertFalse(st["sources"]["ledger"]["header_ok"])
        self.assertEqual(st["dispatch_paused"], "ledger unreadable")
        self.assertEqual(st["eligible_next"], [])


class CarriedCriteria(unittest.TestCase):
    """ledger.md § Carried criteria: a criterion deferred off one row rides on its to-row, which must
    be a plan row — never a phase name (the LOOP-F35 "AC-5 to P4" gap: prose only, nothing carried it)."""

    def test_second_table_does_not_disturb_the_work_list(self):
        led = hq.parse_ledger(LEDGER + CARRIED)
        base = hq.parse_ledger(LEDGER)
        self.assertEqual(list(led["rows"]), ["LOOP-F35"])
        self.assertEqual(led["rows"], base["rows"])
        self.assertEqual(sorted(led["other_rows"]), sorted(base["other_rows"]))
        self.assertEqual((led["duplicates"], led["spelling"]), ([], []))
        self.assertEqual((base["carried_criteria"], base["carried_problems"]), ([], []))

    def test_parse_carried_table(self):
        led = hq.parse_ledger(LEDGER + CARRIED)
        self.assertEqual(led["carried_problems"], [])
        crit = {c["criterion"]: c for c in led["carried_criteria"]}
        self.assertEqual(list(crit), ["AC-LOOP-F35-5", "AC-LOOP-F35-6", "AC-LOOP-F35-7"])
        c5 = crit["AC-LOOP-F35-5"]
        self.assertEqual((c5["from_row"], c5["to_row"], c5["n"], c5["status"], c5["status_detail"]), ("LOOP-F35", "LOOP-F37", 5, "open", None))
        self.assertEqual(c5["decided"], "operator 2026-09-10")
        self.assertTrue(c5["reason"].startswith("the veto half"))
        c6 = crit["AC-LOOP-F35-6"]
        self.assertEqual((c6["status"], c6["status_detail"], c6["to_row"]), ("covered", "#12", "ISO-F13"))
        self.assertEqual(c6["reason"], "mount set is ISO-F13's deliverable | rendered, not policed")  # escaped pipe kept
        self.assertEqual((crit["AC-LOOP-F35-7"]["status"], crit["AC-LOOP-F35-7"]["status_detail"]), ("dropped", "superseded"))
        # a raw pipe in `reason` folds back into `reason`, the status column stays the status
        raw = CARRIED.replace("compose only renders the key", "compose only renders the key | the sandbox proves it")
        c = {x["criterion"]: x for x in hq.parse_ledger(LEDGER + raw)["carried_criteria"]}["AC-LOOP-F35-5"]
        self.assertEqual((c["status"], c["decided"]), ("open", "operator 2026-09-10"))
        self.assertTrue(c["reason"].endswith("renders the key|the sandbox proves it"), c["reason"])  # cells stripped, re-joined on the pipe

    def test_rows_gain_carries_and_deferred_criteria(self):
        st = state(LEDGER + CARRIED)
        self.assertEqual([c["criterion"] for c in st["rows"]["LOOP-F37"]["carries_criteria"]], ["AC-LOOP-F35-5"])
        self.assertEqual(st["rows"]["LOOP-F37"]["carries_criteria"][0]["from_row"], "LOOP-F35")
        self.assertEqual(st["rows"]["ISO-F13"]["carries_criteria"], [])  # covered: no longer open
        self.assertEqual(st["rows"]["MEM-F44"]["carries_criteria"], [])  # dropped
        deferred = st["rows"]["LOOP-F35"]["deferred_criteria"]
        self.assertEqual(
            [(d["criterion"], d["to_row"], d["status"]) for d in deferred],
            [("AC-LOOP-F35-5", "LOOP-F37", "open"), ("AC-LOOP-F35-6", "ISO-F13", "covered"), ("AC-LOOP-F35-7", "MEM-F44", "dropped")],
        )
        self.assertEqual(st["rows"]["LOOP-F37"]["deferred_criteria"], [])
        self.assertEqual(len(st["carried_criteria"]), 3)
        self.assertEqual(st["sources"]["ledger"]["carried_criteria"], 3)
        self.assertEqual(st["alerts"], [])
        self.assertTrue(st["plan_ok"])
        self.assertEqual(st["rows"]["LOOP-F35"]["state"], "spec_handoff")  # the work-item table still reads as before

    def test_coverage_reports_open_carried_criteria(self):
        cov = state(LEDGER + CARRIED)["coverage"]
        self.assertTrue(cov["ok"], cov["problems"])
        self.assertEqual((cov["carried_total"], cov["open_carried_criteria"]), (3, 1))
        self.assertEqual(cov["open_carried_ids"], ["AC-LOOP-F35-5"])
        self.assertEqual(cov["carried_line"], "open carried criteria: 1 (rows: LOOP-F37)")
        self.assertEqual(state(LEDGER)["coverage"]["carried_line"], "open carried criteria: 0")
        # coverage_check without a ledger keeps its old contract
        cov0 = hq.coverage_check(hq.parse_plan(PLAN), hq.parse_matrix(MATRIX))
        self.assertEqual((cov0["ok"], cov0["open_carried_criteria"], cov0["carried_total"]), (True, 0, 0))

    def test_merged_from_row_keeps_the_open_criterion_visible(self):
        st = state(ledger([merged_row("LOOP-F35", 2)]) + CARRIED)
        self.assertEqual(st["rows"]["LOOP-F35"]["state"], "merged")
        self.assertEqual(st["coverage"]["carried_line"], "open carried criteria: 1 (rows: LOOP-F37)")
        self.assertEqual([c["criterion"] for c in st["rows"]["LOOP-F37"]["carries_criteria"]], ["AC-LOOP-F35-5"])
        self.assertFalse(any(a["kind"].startswith("carried") for a in st["alerts"]))  # merging the from-row is the point

    def test_unknown_to_row_is_a_problem_and_an_alert(self):
        for bad in ("P4", "P4-sandbox", "LOOP-F99"):
            st = state(LEDGER + CARRIED.replace("| LOOP-F37 |", f"| {bad} |"))
            self.assertIn(f"carried criterion AC-LOOP-F35-5 names unknown row {bad}", st["coverage"]["problems"])
            self.assertFalse(st["coverage"]["ok"])
            self.assertEqual(st["dispatch_paused"], "plan-changed: hashes or coverage check")
            alert = next(a for a in st["alerts"] if a["kind"] == "carried-criterion-unknown-row")
            self.assertEqual(alert["row"], "LOOP-F35")
            self.assertIn(f"names unknown row {bad}", alert["detail"])
            self.assertNotIn(bad, st["rows"])
            self.assertEqual(st["coverage"]["carried_line"], f"open carried criteria: 1 (rows: {bad})")  # still counted, never hidden

    def test_defer_to_row_is_a_problem_too(self):
        st = state(LEDGER + CARRIED.replace("| LOOP-F37 |", "| RT-F04 |"))
        self.assertTrue(any("names DEFER row RT-F04" in p for p in st["coverage"]["problems"]), st["coverage"]["problems"])
        self.assertTrue(any(a["kind"] == "carried-criterion-unknown-row" for a in st["alerts"]))

    def test_malformed_status_or_id_reads_open_and_alerts(self):
        st = state(LEDGER + CARRIED.replace("| open |", "| maybe |"))
        self.assertEqual([c["criterion"] for c in st["rows"]["LOOP-F37"]["carries_criteria"]], ["AC-LOOP-F35-5"])  # fail-safe: open
        self.assertTrue(any("status 'maybe'" in p for p in st["sources"]["ledger"]["carried_problems"]))
        self.assertTrue(any(a["kind"] == "carried-criterion-malformed" for a in st["alerts"]))
        self.assertFalse(st["coverage"]["ok"])
        led = hq.parse_ledger(LEDGER + CARRIED.replace("| AC-LOOP-F35-5 |", "| LOOP-F35-5 |"))
        self.assertTrue(any("is not AC-<row>-<n>" in p for p in led["carried_problems"]), led["carried_problems"])
        led = hq.parse_ledger(LEDGER + CARRIED.replace("| AC-LOOP-F35-5 | LOOP-F35 |", "| AC-LOOP-F35-5 | LOOP-F36 |"))
        self.assertEqual(led["carried_criteria"][0]["from_row"], "LOOP-F35")  # the id is authoritative
        self.assertTrue(any("from row LOOP-F36" in p for p in led["carried_problems"]))
        led = hq.parse_ledger(LEDGER + CARRIED.replace("| AC-LOOP-F35-5 |", "| AC‑LOOP‑F35‑5 |"))  # U+2011 hyphens
        self.assertEqual(led["carried_criteria"][0]["criterion"], "AC-LOOP-F35-5")

    def test_dispatch_text_names_the_carried_criteria(self):
        st = state(ledger([merged_row("LOOP-F35", 2)]) + CARRIED)
        by_id = {e["id"]: e for e in st["eligible_next"]}
        t = by_id["LOOP-F37"]["dispatch_text"]
        self.assertIn(
            "Carried criteria this row MUST cover (deferred from other rows; the merge gate checks them): "
            "AC-LOOP-F35-5 (from LOOP-F35: the veto half needs the gates plugin; compose only renders the key)",
            t,
        )
        self.assertIn("never renumbered", t)
        self.assertLess(t.index("every id it carries"), t.index("Carried criteria this row MUST cover"))
        self.assertLess(t.index("Carried criteria this row MUST cover"), t.index("Upstream ask:"))
        self.assertNotIn("Carried criteria", by_id["MEM-F44"]["dispatch_text"])
        self.assertIn("carries none |", by_id["MEM-F44"]["orchestrator_text"])
        self.assertIn("; carried criteria AC-LOOP-F35-5 |", by_id["LOOP-F37"]["orchestrator_text"])
        adopt_row = dict(st["rows"]["OBS-F45"], carries_criteria=[{"criterion": "AC-LOOP-F35-9", "from_row": "LOOP-F35", "reason": "r"}])
        adopt = hq.dispatch_text("OBS-F45", adopt_row, hq.load_config(None))
        self.assertIn("Carried criteria this row MUST cover", adopt)
        self.assertIn("AC-LOOP-F35-9 (from LOOP-F35: r)", adopt)


class UpstreamAsks(unittest.TestCase):
    """upstream-asks.md § Upstream asks: every core-change candidate is a UA row on its source row."""

    def test_parse_upstream_asks(self):
        asks = hq.parse_upstream_asks(UPSTREAM_ASKS)
        self.assertEqual([a["id"] for a in asks], ["UA-1", "UA-2", "UA-3"])
        a1, a2, a3 = asks
        self.assertEqual((a1["source_row"], a1["disposition"], a1["owner"], a1["updated"]), ("LOOP-F35", "bypassed", "orchestrator", "2026-09-10"))
        self.assertEqual(a1["disposition_detail"], "wrapper on PATH in the fixture, not filed")
        self.assertTrue(a1["citation"].endswith("tools/bot_mode_dm.py:316"))
        self.assertEqual(a2["ask"], "plugin load hook must see `name|alias` pairs")  # raw pipe folded back into `ask`
        self.assertEqual((a2["disposition"], a2["disposition_detail"], a2["owner"]), ("open", None, "—"))
        self.assertEqual((a3["disposition"], a3["disposition_detail"]), ("filed", "https://github.com/NousResearch/hermes-agent/issues/999"))
        self.assertTrue(all(a["id_ok"] and a["disposition_ok"] for a in asks))
        self.assertEqual(hq.parse_upstream_asks(""), [])
        self.assertEqual(hq.parse_upstream_asks("# Upstream asks\n\n(none yet)\n"), [])

    def test_rows_gain_upstream_asks(self):
        st = hq.build_state(PLAN, MATRIX, LEDGER, now=NOW, upstream_asks_text=UPSTREAM_ASKS)
        self.assertEqual(st["rows"]["LOOP-F35"]["upstream_asks"], ["UA-1"])
        self.assertEqual(st["rows"]["LOOP-F37"]["upstream_asks"], ["UA-2"])
        self.assertEqual(st["rows"]["GOV-F27"]["upstream_asks"], ["UA-3"])
        self.assertEqual(st["rows"]["MEM-F44"]["upstream_asks"], [])
        self.assertEqual(len(st["upstream_asks"]), 3)
        self.assertEqual(st["sources"]["upstream_asks"], {"provided": True, "rows": 3})
        self.assertEqual(st["alerts"], [])
        # existing callers pass nothing: no asks, nothing provided, everything else identical
        st0 = state(LEDGER)
        self.assertEqual(st0["rows"]["LOOP-F35"]["upstream_asks"], [])
        self.assertEqual(st0["sources"]["upstream_asks"], {"provided": False, "rows": 0})
        self.assertEqual(st0["upstream_asks"], [])

    def test_malformed_or_unknown_row_alerts_but_never_pauses(self):
        text = UPSTREAM_ASKS + "| U-4 | LOOP-F35 | c | a | parked | — | 2026-09-11 |\n| UA-5 | FOO-F99 | c | a | open | — | 2026-09-11 |\n"
        st = hq.build_state(PLAN, MATRIX, LEDGER, now=NOW, upstream_asks_text=text)
        kinds = [(a["kind"], a["row"]) for a in st["alerts"]]
        self.assertIn(("upstream-ask-malformed", "LOOP-F35"), kinds)
        self.assertIn(("upstream-ask-unknown-row", None), kinds)
        detail = next(a["detail"] for a in st["alerts"] if a["kind"] == "upstream-ask-malformed")
        self.assertIn("'U-4' is not UA-<n>", detail)
        self.assertIn("'parked' is not open", detail)
        self.assertEqual(st["rows"]["LOOP-F35"]["upstream_asks"], ["UA-1", "U-4"])  # kept visible either way
        self.assertTrue(st["plan_ok"])
        self.assertIsNone(st["dispatch_paused"])


class Cli(unittest.TestCase):
    def test_upstream_asks_flag_is_optional_and_a_missing_file_is_an_empty_table(self):
        base = [sys.executable, str(HERE / "hermes_queue.py"), "--plan", str(DOCS / "dispatch-plan.md"), "--matrix", str(DOCS / "gap-matrix.md"),
                "--ledger", str(HERE / "fixtures" / "ledger.md"), "--now", NOW, "--json"]
        with tempfile.TemporaryDirectory() as d:
            asks = Path(d) / "upstream-asks.md"
            asks.write_text(UPSTREAM_ASKS, encoding="utf-8")
            p = subprocess.run(base + ["--upstream-asks", str(asks)], capture_output=True, text=True, check=False)
            self.assertEqual(p.returncode, 0, p.stderr)
            self.assertEqual(json.loads(p.stdout)["rows"]["LOOP-F35"]["upstream_asks"], ["UA-1"])
            p = subprocess.run(base + ["--upstream-asks", str(Path(d) / "missing.md")], capture_output=True, text=True, check=False)
            self.assertEqual((p.returncode, p.stderr), (0, ""))
            self.assertEqual(json.loads(p.stdout)["sources"]["upstream_asks"], {"provided": True, "rows": 0})

    def test_json_flag_and_exit_code(self):
        p = subprocess.run(
            [sys.executable, str(HERE / "hermes_queue.py"), "--plan", str(DOCS / "dispatch-plan.md"), "--matrix", str(DOCS / "gap-matrix.md"),
             "--ledger", str(HERE / "fixtures" / "ledger.md"), "--now", NOW, "--json"],
            capture_output=True, text=True, check=False,
        )
        self.assertEqual(p.returncode, 0, p.stderr)
        out = json.loads(p.stdout)
        self.assertEqual(out["in_flight"], ["LOOP-F35"])
        self.assertEqual(out["generated_at"], NOW)
        self.assertEqual(len(out["rows"]), 61)

    def test_help(self):
        p = subprocess.run([sys.executable, str(HERE / "hermes_queue.py"), "--help"], capture_output=True, text=True, check=False)
        self.assertEqual(p.returncode, 0)
        self.assertIn("--ledger", p.stdout)


if __name__ == "__main__":
    unittest.main()
