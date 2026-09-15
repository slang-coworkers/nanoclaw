#!/usr/bin/env python3
"""Tests for ops/nemoclaw-coworkers/demo_path.py: the spec loads, compute() gives the expected statuses and
ETAs on hand-built live states (all merged → done with the ledger date; an in-flight BUILD → remaining
hours from the stage factor; queued rows behind a false gate start when the gate's rows finish; a paused
row flags the rung and drops out of the ETA; a blocked row inside a gate flags the rungs behind it; the
BUILD lane serialises BUILD rows; R5 is R4 + 21..35 days), load_live() degrades on a missing state.json
to "unknown" without raising, the real dispatch-plan.md + gap-matrix.md give the queue's order, and the
two renderers hold their contracts (Slack ≤ 25 lines with every rung id, HTML with one row per rung).
Run: python3 -m unittest ops/nemoclaw-coworkers/test_demo_path.py
"""

from __future__ import annotations

import contextlib
import importlib.util
import io
import json
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
NOW = datetime(2026, 9, 15, 10, 0, tzinfo=timezone.utc)
GEN = "2026-09-15T09:50:00Z"
H = timedelta(hours=1)

# The demo-path rows plus the other batch-2 rows the batch2_merged gate counts (COST-F30, LOOP-F40).
ROW_META = {
    "LOOP-F35": ("BUILD", "1a"),
    "RT-F01": ("CONFIGURE", "1b"), "RT-F02": ("CONFIGURE", "1b"), "RT-F03": ("CONFIGURE", "1b"),
    "GOV-F23": ("CONFIGURE", "1b"), "GOV-F27": ("CONFIGURE", "1b"),
    "LOOP-F37": ("BUILD", "2"), "GOV-F24": ("BUILD", "2"), "GOV-F25": ("BUILD", "2"), "COST-F29": ("BUILD", "2"),
    "COST-F30": ("BUILD", "2"), "LOOP-F40": ("CONFIGURE", "2"),
    "CRED-F28": ("BUILD", "3"), "ISO-F13": ("CONFIGURE", "3"), "ISO-F14": ("CONFIGURE", "3"), "ISO-F15": ("CONFIGURE", "3"),
    "A2A-F21": ("CONFIGURE", "4"),
    "ISO-F17": ("ADOPT", "adopt"),
}
GATES = {"1a": (), "1b": ("1a_first_pass",), "2": ("1a_first_pass",), "3": ("batch2_merged", "podman_box"),
         "4": ("batch2_merged",), "adopt": ("batch3_merged", "batch4_merged")}
ORDER = [(rid, GATES[batch]) for rid, (_disp, batch) in ROW_META.items()]


def load_module():
    spec = importlib.util.spec_from_file_location("demo_path", HERE / "demo_path.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def make_state(states: dict, gating: dict | None = None, wip: int = 3, supervise: dict | None = None, paused: list | None = None) -> dict:
    """A state.json in build_state's shape: every ROW_META row queued unless `states` says otherwise."""
    rows = {}
    for rid, (disp, batch) in ROW_META.items():
        rows[rid] = {"state": states.get(rid, "queued"), "disposition": disp, "batch": batch}
        if rid in (paused or []):
            rows[rid]["paused"] = True
        if states.get(rid) == "blocked":
            rows[rid]["state_reason"] = "cap: test FAIL x2, no round 3 authorized"
    g = {"1a_first_pass": False, "batch2_merged": False, "batch3_merged": False, "batch4_merged": False, "podman_box": True}
    g.update(gating or {})
    in_flight = [r for r, s in states.items() if s in ("dispatched", "spec_handoff", "building", "pr_open", "testing", "review", "gate")]
    return {
        "generated_at": GEN, "rows": rows, "gating": g,
        "wip": {"limit": wip, "in_flight": len(in_flight), "free": max(0, wip - len(in_flight)), "build_in_flight": False},
        "supervise": {"rows": supervise or {}},
    }


def live_of(state: dict | None, config: dict | None = None, merged_at: dict | None = None, order=ORDER, state_err=None) -> dict:
    return {"state": state, "state_err": state_err, "config": config or {}, "config_err": None, "order": list(order) if order else None,
            "order_err": None if order else "no plan", "merged_at": merged_at or {}, "ledger_err": None,
            "generated_at": (state or {}).get("generated_at")}


def by_id(items: list) -> dict:
    return {x["id"]: x for x in items}


class ComputeTest(unittest.TestCase):
    def setUp(self):
        self.mod = load_module()
        self.spec = self.mod.load_spec()

    def rungs(self, live: dict, now: datetime = NOW) -> dict:
        return by_id(self.mod.compute(self.spec, live, now)["rungs"])

    def test_spec_loads_with_the_five_rungs_and_their_rows(self):
        ids = [r["id"] for r in self.spec["rungs"]]
        self.assertEqual(ids, ["R1", "R2", "R3", "R4", "R5"])
        r1 = by_id(self.spec["rungs"])["R1"]
        self.assertEqual({x["id"] for x in r1["rows"]},
                         {"LOOP-F35", "LOOP-F37", "GOV-F24", "GOV-F25", "GOV-F23", "GOV-F27", "RT-F01", "RT-F02", "RT-F03", "COST-F29"})
        self.assertEqual(self.spec["planning_hours"], {"BUILD": 48.0, "CONFIGURE": 15.0, "ADOPT": 10.0})
        self.assertEqual(self.spec["stage_factors"]["building"], 0.6)
        r4 = by_id(self.spec["rungs"])["R4"]
        self.assertEqual(r4["requires"], ["R2", "R3"])
        self.assertEqual(r4["rows"][0]["after"], ["P6-FLEET"], "ISO-F17's proof runs against the P6 boot")
        r5 = by_id(self.spec["rungs"])["R5"]
        self.assertEqual((r5["manual"][0]["hours"], r5["manual"][0]["hours_max"]), (504.0, 840.0))
        self.assertIn("planning_hours", self.spec["notes"])

    def test_all_merged_is_done_with_the_ledger_merge_date(self):
        states = {rid: "merged" for rid in ROW_META}
        merged_at = {rid: "2026-09-12T08:00:00Z" for rid in ROW_META}
        merged_at["COST-F29"] = "2026-09-14T21:43:00Z"  # the last R1 row to land
        rungs = self.rungs(live_of(make_state(states), merged_at=merged_at))
        r1 = rungs["R1"]
        self.assertEqual(r1["status"], "done")
        self.assertEqual(r1["done_at"], "2026-09-14T21:43:00Z", "done date = the latest ledger merge stamp among the rung's rows")
        self.assertEqual(r1["hours_remaining"], 0.0)
        self.assertTrue(all(r["done"] and r["label"] == "merged" for r in r1["rows"]))
        self.assertEqual(r1["rows"][0]["done_at"], "2026-09-12T08:00:00Z")
        # R3 has a manual step with no done_at: rows merged, but the rung is not done and its ETA is the manual item.
        r3 = rungs["R3"]
        self.assertEqual(r3["status"], "in_progress")
        self.assertEqual(r3["eta_utc"], (NOW + 8 * H).isoformat().replace("+00:00", "Z"))
        self.assertEqual(r3["manual"][0]["eta"], r3["eta_utc"])

    def test_manual_done_at_completes_the_rung(self):
        spec = json.loads(json.dumps(self.spec))
        for rung in spec["rungs"]:
            for m in rung["manual"]:
                m["done_at"] = "2026-09-14T00:00:00Z"
        states = {rid: "merged" for rid in ROW_META}
        rungs = by_id(self.mod.compute(spec, live_of(make_state(states)), NOW)["rungs"])
        self.assertEqual([rungs[r]["status"] for r in ("R1", "R2", "R3", "R4", "R5")], ["done"] * 5)
        # No ledger stamps: the done date falls back to state.json's generated_at (rows) / done_at (manual).
        self.assertEqual(rungs["R1"]["done_at"], GEN)

    def test_in_flight_build_row_remaining_hours_from_the_stage_factor(self):
        state = make_state({"LOOP-F35": "merged", "LOOP-F37": "pr_open"}, gating={"1a_first_pass": True},
                           supervise={"LOOP-F37": {"stage": "building"}})
        rungs = self.rungs(live_of(state, merged_at={"LOOP-F35": "2026-09-10T21:43:00Z"}))
        r1 = rungs["R1"]
        self.assertEqual(r1["status"], "in_progress")
        rows = by_id(r1["rows"])
        f37 = rows["LOOP-F37"]
        self.assertEqual(f37["state"], "building", "the supervisor's finer stage wins while the row is in flight")
        self.assertEqual(f37["remaining_hours"], 28.8)
        self.assertEqual(f37["start_utc"], NOW.isoformat().replace("+00:00", "Z"))
        self.assertEqual(f37["eta"], (NOW + 28.8 * H).isoformat().replace("+00:00", "Z"))
        self.assertTrue(f37["in_flight"])
        # List schedule on 3 slots, dispatch order: RT-F01 / RT-F02 take the two free slots now (15 h each), RT-F03 and
        # GOV-F23 follow at +15 h, GOV-F27 at +28.8 h when LOOP-F37's slot frees; GOV-F24, the next BUILD, takes the
        # first free slot at +30 h (the lane is free from +28.8 h), then GOV-F25 and COST-F29 follow one at a time.
        self.assertEqual(rows["RT-F01"]["start_utc"], NOW.isoformat().replace("+00:00", "Z"))
        self.assertEqual(rows["RT-F02"]["start_utc"], NOW.isoformat().replace("+00:00", "Z"))
        self.assertEqual(rows["RT-F03"]["start_utc"], (NOW + 15 * H).isoformat().replace("+00:00", "Z"))
        self.assertEqual(rows["GOV-F27"]["start_utc"], (NOW + 28.8 * H).isoformat().replace("+00:00", "Z"))
        self.assertEqual(rows["GOV-F24"]["start_utc"], (NOW + 30 * H).isoformat().replace("+00:00", "Z"))
        self.assertEqual(rows["GOV-F25"]["start_utc"], (NOW + 78 * H).isoformat().replace("+00:00", "Z"), "BUILD lane: after GOV-F24")
        self.assertEqual(rows["COST-F29"]["start_utc"], (NOW + 126 * H).isoformat().replace("+00:00", "Z"))
        self.assertEqual(r1["eta_utc"], (NOW + 174 * H).isoformat().replace("+00:00", "Z"))
        self.assertEqual(r1["hours_remaining"], 174.0)
        self.assertEqual(r1["eta_date"], "2026-09-22")

    def test_queued_rows_behind_a_false_gate_start_after_the_gate_rows_finish(self):
        # Batch 1b all merged, batch 2 all queued but LOOP-F37 in review: batch2_merged is false, so batch 3 / 4
        # rows (R2, R3) start when the last batch-2 row finishes; podman_box true.
        states = {rid: "merged" for rid, (_d, b) in ROW_META.items() if b in ("1a", "1b")}
        states["LOOP-F37"] = "review"
        state = make_state(states, gating={"1a_first_pass": True}, wip=3)
        rungs = self.rungs(live_of(state))
        r1, r2, r3 = rungs["R1"], rungs["R2"], rungs["R3"]
        self.assertEqual(r1["status"], "in_progress")
        # Batch 2 (BUILD lane): F37 review 9.6 h, then GOV-F24, GOV-F25, COST-F29, COST-F30 (48 h each), LOOP-F40 15 h in parallel.
        batch2_end = NOW + (9.6 + 4 * 48) * H
        self.assertEqual(by_id(r1["rows"])["COST-F29"]["eta"], (NOW + (9.6 + 3 * 48) * H).isoformat().replace("+00:00", "Z"))
        self.assertEqual(r2["status"], "blocked_by_gate")
        self.assertEqual(r2["gates"], ["batch2_merged"])
        cred = by_id(r2["rows"])["CRED-F28"]
        self.assertEqual(cred["start_utc"], batch2_end.isoformat().replace("+00:00", "Z"), "the gate opens when COST-F30, the last batch-2 row, finishes")
        self.assertIn("waits for batch2_merged", cred["blockers"])
        self.assertEqual(r2["eta_utc"], (batch2_end + 48 * H).isoformat().replace("+00:00", "Z"))
        self.assertEqual(r3["status"], "blocked_by_gate")
        a2a = by_id(r3["rows"])["A2A-F21"]
        self.assertGreaterEqual(a2a["start_utc"], cred["start_utc"])
        rooms = r3["manual"][0]
        self.assertEqual(rooms["eta"], (datetime.fromisoformat(a2a["eta"].replace("Z", "+00:00")) + 8 * H).isoformat().replace("+00:00", "Z"),
                         "the manual rooms step starts when A2A-F21 finishes")
        self.assertEqual(r3["eta_utc"], rooms["eta"])
        # R4: P6-FLEET starts when R2 and R3 are done, ISO-F17 (after P6-FLEET) ends 10 h later; R5 = R4 + 21..35 d.
        r4, r5 = rungs["R4"], rungs["R5"]
        self.assertEqual(r4["status"], "blocked_by_gate")
        p6 = r4["manual"][0]
        r2r3 = max(datetime.fromisoformat(r2["eta_utc"].replace("Z", "+00:00")), datetime.fromisoformat(r3["eta_utc"].replace("Z", "+00:00")))
        self.assertEqual(p6["eta"], (r2r3 + 48 * H).isoformat().replace("+00:00", "Z"))
        self.assertEqual(by_id(r4["rows"])["ISO-F17"]["eta"], (r2r3 + 58 * H).isoformat().replace("+00:00", "Z"))
        self.assertEqual(r4["eta_utc"], by_id(r4["rows"])["ISO-F17"]["eta"])
        r4_eta = datetime.fromisoformat(r4["eta_utc"].replace("Z", "+00:00"))
        self.assertEqual(r5["eta_utc"], (r4_eta + timedelta(days=21)).isoformat().replace("+00:00", "Z"))
        self.assertEqual(r5["eta_max_utc"], (r4_eta + timedelta(days=35)).isoformat().replace("+00:00", "Z"))
        self.assertEqual(r5["status"], "blocked_by_gate")

    def test_podman_box_false_makes_batch3_unknown_with_the_reason(self):
        states = {rid: "merged" for rid, (_d, b) in ROW_META.items() if b in ("1a", "1b", "2")}
        state = make_state(states, gating={"1a_first_pass": True, "batch2_merged": True, "podman_box": False})
        rungs = self.rungs(live_of(state))
        r2 = rungs["R2"]
        self.assertIsNone(r2["eta_utc"])
        self.assertIn("gate podman_box: config.podman_box is false", by_id(r2["rows"])["CRED-F28"]["blockers"])
        self.assertTrue(any("podman_box" in b for b in r2["blockers"]))
        # R3 (batch 4) does not need podman and gets a date; R4 needs R2 → unknown.
        self.assertIsNotNone(rungs["R3"]["eta_utc"])
        self.assertIsNone(rungs["R4"]["eta_utc"])
        self.assertIn("requires R2 (ETA unknown)", rungs["R4"]["blockers"])

    def test_paused_row_is_flagged_and_excluded_from_the_eta(self):
        state = make_state({"LOOP-F35": "merged"}, gating={"1a_first_pass": True})
        cfg = {"wip": 3, "paused_rows": ["GOV-F25"], "waive": []}
        rungs = self.rungs(live_of(state, config=cfg))
        r1 = rungs["R1"]
        rows = by_id(r1["rows"])
        self.assertEqual(rows["GOV-F25"]["label"], "paused")
        self.assertIsNone(rows["GOV-F25"]["eta"])
        self.assertEqual(r1["flags"], ["blocked by pause: GOV-F25"])
        self.assertIsNotNone(r1["eta_utc"], "the ETA is computed over the other rows")
        # 3 slots: five 1b CONFIGURE rows first (RT-F01..F03 at 0 h, GOV-F23/F27 at 15 h), LOOP-F37 at 15 h in the freed
        # slot, then the lane GOV-F24 [63, 111] → COST-F29 [111, 159]; GOV-F25 (paused) is skipped, not waited for.
        self.assertEqual(r1["eta_utc"], (NOW + 159 * H).isoformat().replace("+00:00", "Z"))
        self.assertEqual(r1["status"], "in_progress")
        # Unpaused, the lane has four BUILDs and the ETA moves out by one: the pause is what the flag explains.
        r1u = self.rungs(live_of(state, config={"wip": 3}))["R1"]
        self.assertEqual(r1u["eta_utc"], (NOW + 207 * H).isoformat().replace("+00:00", "Z"))
        self.assertEqual(r1u["flags"], [])
        # The paused row is inside the batch2_merged gate too: R2 gets the pause flag through the gate.
        self.assertTrue(any(f.startswith("blocked by pause: GOV-F25 paused in gate batch2_merged") for f in rungs["R2"]["flags"]), rungs["R2"]["flags"])

    def test_blocked_row_is_a_blocker_and_waived_row_counts_as_done(self):
        state = make_state({"LOOP-F35": "merged", "COST-F30": "blocked"}, gating={"1a_first_pass": True})
        cfg = {"wip": 3, "waive": ["LOOP-F40", "RT-F03"]}
        rungs = self.rungs(live_of(state, config=cfg))
        r1 = rungs["R1"]
        rows = by_id(r1["rows"])
        self.assertEqual(rows["RT-F03"]["label"], "waived")
        self.assertTrue(rows["RT-F03"]["done"])
        self.assertEqual(r1["flags"], [])
        self.assertTrue(any(b.startswith("COST-F30 blocked in gate batch2_merged") for b in rungs["R2"]["blockers"]), rungs["R2"]["blockers"])
        self.assertIsNotNone(rungs["R2"]["eta_utc"], "a blocked row inside the gate is excluded from the gate's finish time, not fatal")
        # A rung whose own row is blocked: the row's reason is a rung blocker and the rung's ETA is unknown.
        state2 = make_state({"LOOP-F35": "merged", "GOV-F24": "blocked"}, gating={"1a_first_pass": True})
        r1b = self.rungs(live_of(state2))["R1"]
        self.assertIsNone(r1b["eta_utc"])
        self.assertEqual(r1b["blockers"], ["GOV-F24 blocked — cap: test FAIL x2, no round 3 authorized"])

    def test_wip_limit_and_more_in_flight_than_the_limit(self):
        # Five CONFIGURE rows in flight on a limit of 3: a queued row starts only when running drops below 3.
        states = {"LOOP-F35": "merged", "RT-F01": "dispatched", "RT-F02": "dispatched", "RT-F03": "dispatched", "GOV-F23": "dispatched", "GOV-F27": "dispatched"}
        state = make_state(states, gating={"1a_first_pass": True})
        rows = by_id(self.rungs(live_of(state, config={"wip": 3}))["R1"]["rows"])
        inflight_end = NOW + 15 * 0.85 * H
        self.assertEqual(rows["LOOP-F37"]["start_utc"], inflight_end.isoformat().replace("+00:00", "Z"))
        # wip from config.json wins over state.json's limit; at 7, two slots are free beside the five in flight.
        res = self.mod.compute(self.spec, live_of(state, config={"wip": 7}), NOW)
        self.assertEqual(res["wip_limit"], 7)
        rows7 = by_id(by_id(res["rungs"])["R1"]["rows"])
        self.assertEqual(rows7["LOOP-F37"]["start_utc"], NOW.isoformat().replace("+00:00", "Z"), "two free slots at limit 7")

    def test_not_started_when_a_row_is_queued_and_eligible(self):
        # Nothing dispatched yet: LOOP-F35 is eligible now, so R1 is "not started" (the rest of its rows wait for
        # 1a_first_pass, which LOOP-F35 itself opens); R2..R4 have nothing eligible and wait on gates.
        state = make_state({}, gating={"1a_first_pass": False})
        rungs = self.rungs(live_of(state))
        self.assertEqual(rungs["R1"]["status"], "not_started")
        self.assertIsNotNone(rungs["R1"]["eta_utc"])
        self.assertEqual(by_id(rungs["R1"]["rows"])["LOOP-F37"]["blockers"], ["waits for 1a_first_pass"])
        rows = by_id(rungs["R1"]["rows"])
        self.assertEqual(rows["RT-F01"]["start_utc"], (NOW + 48 * H).isoformat().replace("+00:00", "Z"),
                         "1a_first_pass opens when LOOP-F35 finishes; the first 1b row starts right then")
        self.assertEqual(rows["LOOP-F37"]["start_utc"], (NOW + 63 * H).isoformat().replace("+00:00", "Z"),
                         "the five 1b CONFIGURE rows precede it in dispatch order and hold all three slots until +63 h")
        self.assertEqual([rungs[r]["status"] for r in ("R2", "R3", "R4", "R5")], ["blocked_by_gate"] * 4)

    def test_missing_state_renders_unknown_without_raising(self):
        res = self.mod.compute(self.spec, live_of(None, state_err="state.json not found"), NOW)
        self.assertFalse(res["state_ok"])
        self.assertIn("state.json not found", res["source_errors"])
        for rung in res["rungs"]:
            self.assertEqual(rung["status"], "unknown", rung["id"])
            self.assertIsNone(rung["eta_utc"])
            self.assertTrue(all(r["state"] == "unknown" and r["label"] == "unknown" for r in rung["rows"]))
        r1 = by_id(res["rungs"])["R1"]
        self.assertEqual(len(r1["blockers"]), 1, "unknown rows are collapsed into one line per reason")
        self.assertTrue(r1["blockers"][0].startswith("state.json unavailable: LOOP-F35, LOOP-F37"))
        # A state.json that knows only some rows: the missing ones are unknown, the rung's ETA unknown.
        partial = {"generated_at": GEN, "rows": {"LOOP-F35": {"state": "building", "disposition": "BUILD", "batch": "1a"}}, "gating": {}, "wip": {"limit": 3}}
        res2 = self.mod.compute(self.spec, live_of(partial, order=None), NOW)
        r1 = by_id(res2["rungs"])["R1"]
        self.assertEqual(r1["status"], "in_progress")
        self.assertIsNone(r1["eta_utc"])
        self.assertEqual(res2["order_source"], "demo-path.json")
        self.assertEqual(by_id(r1["rows"])["LOOP-F37"]["blockers"], ["not in state.json"])

    def test_render_slack_contract(self):
        for live in (live_of(make_state({"LOOP-F35": "merged", "LOOP-F37": "building"}, gating={"1a_first_pass": True})),
                     live_of(None, state_err="state.json not found"),
                     live_of(make_state({rid: "merged" for rid in ROW_META}))):
            text = self.mod.render_slack(self.mod.compute(self.spec, live, NOW))
            lines = text.split("\n")
            self.assertLessEqual(len(lines), 25, text)
            self.assertTrue(lines[0].startswith("*Demo path*"))
            for rid in ("R1", "R2", "R3", "R4", "R5"):
                self.assertIn(f"*{rid}*", text)
            self.assertNotIn("**", text, "single-asterisk bold only")
            self.assertNotIn("#", "".join(line[:1] for line in lines), "no headings")
            self.assertNotIn("|", text, "no tables")
            self.assertTrue(all(line.lstrip().startswith(("•", "*", "_", "✅", "🔨", "⏳", "▫", "❔")) for line in lines), lines)
            for ch in "<>&":
                self.assertNotIn(ch, text, "the renderer emits nothing that needs mrkdwn escaping; SlackClient escapes anyway")
        text = self.mod.render_slack(self.mod.compute(self.spec, live_of(make_state({"LOOP-F35": "merged", "LOOP-F37": "building"}, gating={"1a_first_pass": True})), NOW))
        self.assertIn("LOOP-F37 building", text)
        self.assertIn("*in progress*", text)
        self.assertIn("ETA 2026-", text)
        self.assertIn("to 2026-", text, "R5 renders as a date range")

    def test_render_slack_caps_at_25_lines_with_many_flags(self):
        spec = json.loads(json.dumps(self.spec))
        spec["rungs"] = spec["rungs"] * 4  # 20 rungs → far more than 25 candidate lines
        text = self.mod.render_slack(self.mod.compute(spec, live_of(make_state({})), NOW))
        self.assertEqual(len(text.split("\n")), 25)
        self.assertTrue(text.split("\n")[-1].startswith("_model:"), "the footer survives truncation")

    def test_render_html_contract(self):
        res = self.mod.compute(self.spec, live_of(make_state({"LOOP-F35": "merged", "LOOP-F37": "building", "COST-F30": "blocked"},
                                                             gating={"1a_first_pass": True}), config={"paused_rows": ["LOOP-F40"]}), NOW)
        frag = self.mod.render_html(res)
        self.assertTrue(frag.lstrip().startswith("<style>"))
        self.assertIn("<h2>Demo path", frag)
        self.assertNotIn("<html", frag, "a fragment, not a page")
        for rid in ("R1", "R2", "R3", "R4", "R5"):
            self.assertIn(f"<b>{rid}</b>", frag)
        self.assertIn("LOOP-F37 · building", frag)
        self.assertIn("dp-row merged", frag)
        self.assertIn("blocked by pause: LOOP-F40 paused in gate batch2_merged", frag)
        self.assertIn("COST-F30 blocked in gate batch2_merged", frag)
        self.assertIn("ETA model", frag)
        self.assertIn("&lt;-", frag, "the notes are HTML-escaped")
        # The text of a blocker reason is escaped end to end.
        state = make_state({"LOOP-F35": "merged", "GOV-F24": "blocked"}, gating={"1a_first_pass": True})
        state["rows"]["GOV-F24"]["state_reason"] = "<script>alert(1)</script> & co"
        frag = self.mod.render_html(self.mod.compute(self.spec, live_of(state), NOW))
        self.assertNotIn("<script>", frag)
        self.assertIn("&lt;script&gt;", frag)

    def test_result_is_json_serialisable_and_deterministic(self):
        live = live_of(make_state({"LOOP-F35": "merged", "LOOP-F37": "building"}, gating={"1a_first_pass": True}))
        a = json.dumps(self.mod.compute(self.spec, live, NOW), sort_keys=True)
        b = json.dumps(self.mod.compute(self.spec, live, NOW), sort_keys=True)
        self.assertEqual(a, b)


class LoadLiveTest(unittest.TestCase):
    """load_live against a temp checkout: the real dispatch-plan.md + gap-matrix.md for the order, a ledger
    for the merge stamps, and every missing file degrading to an error string, never an exception."""

    def setUp(self):
        self.mod = load_module()
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "checkout"
        self.ap = self.root / "data" / "shared" / "hermes" / "autopilot"
        self.ap.mkdir(parents=True)

    def tearDown(self):
        self.tmp.cleanup()

    def test_missing_everything_is_unknown_not_an_exception(self):
        live = self.mod.load_live(str(self.root))
        self.assertIsNone(live["state"])
        self.assertIn("state.json not found", live["state_err"])
        self.assertIn("config.json not found", live["config_err"])
        self.assertIsNone(live["order"])
        self.assertIn("not found", live["order_err"])
        self.assertIn("ledger.md not found", live["ledger_err"])
        res = self.mod.compute(self.mod.load_spec(), live, NOW)
        self.assertEqual({r["status"] for r in res["rungs"]}, {"unknown"})
        self.assertEqual(len(res["source_errors"]), 4)
        # A corrupt state.json / config.json is an error string too.
        (self.ap / "state.json").write_text("{not json")
        (self.ap / "config.json").write_text("[]")
        live = self.mod.load_live(str(self.root))
        self.assertIn("state.json unreadable", live["state_err"])
        self.assertIn("config.json is not an object", live["config_err"])
        self.assertEqual(live["config"], {})

    def test_real_plan_and_matrix_give_the_queue_order_and_the_ledger_gives_merge_stamps(self):
        docs = self.root / "docs" / "hermes-port"
        docs.mkdir(parents=True)
        for name in ("dispatch-plan.md", "gap-matrix.md"):
            (docs / name).write_text((REPO / "docs" / "hermes-port" / name).read_text(encoding="utf-8"), encoding="utf-8")
        ledger = self.root / "groups" / "orchestrator" / "reports" / "ledger.md"
        ledger.parent.mkdir(parents=True)
        ledger.write_text(
            "# ledger\n\n| row-id | dispatched | spec accepted | PR | verdict | merged/blocked | notes |\n| --- | --- | --- | --- | --- | --- | --- |\n"
            "| LOOP-F35 | 2026-09-09 12:20 IST | 2026-09-09 15:27 IST | #2 | PASS · APPROVE | MERGED `1e3e63f` (squash) — 2026-09-10 21:43Z — 4/4 AC | batch 1a |\n"
            "| MEM-F44 | 2026-09-11 09:00 IST | — | #3 | PASS | MERGED `abc1234` 2026-09-12 15:30 IST | batch 1b |\n"
            "| COST-F30 | 2026-09-13 10:00 IST | — | — | — | blocked: STOP — cap | batch 2 |\n", encoding="utf-8")
        (self.ap / "state.json").write_text(json.dumps(make_state({"LOOP-F35": "merged"}, gating={"1a_first_pass": True})))
        (self.ap / "config.json").write_text(json.dumps({"wip": 2, "waive": ["LOOP-F40"], "paused_rows": []}))
        live = self.mod.load_live(str(self.root))
        self.assertIsNone(live["order_err"])
        order = [rid for rid, _ in live["order"]]
        self.assertEqual(order[0], "LOOP-F35")
        self.assertLess(order.index("COST-F29"), order.index("CRED-F28"))
        self.assertLess(order.index("A2A-F21"), order.index("ISO-F17"))
        gates = dict(live["order"])
        self.assertEqual(gates["CRED-F28"], ("batch2_merged", "podman_box"))
        self.assertEqual(gates["ISO-F17"], ("batch3_merged", "batch4_merged"))
        self.assertEqual(live["merged_at"], {"LOOP-F35": "2026-09-10T21:43:00Z", "MEM-F44": "2026-09-12T10:00:00Z"}, "IST stamps convert to UTC; blocked rows have none")
        res = self.mod.compute(self.mod.load_spec(), live, NOW)
        self.assertEqual(res["order_source"], "hermes_queue.dispatch_order")
        self.assertEqual(res["wip_limit"], 2)
        self.assertEqual(res["waived"], ["LOOP-F40"])
        r1 = by_id(res["rungs"])["R1"]
        self.assertEqual(by_id(r1["rows"])["LOOP-F35"]["done_at"], "2026-09-10T21:43:00Z")
        self.assertEqual(r1["status"], "in_progress")
        self.assertIsNotNone(r1["eta_utc"])

    def test_cli_prints_and_exits_zero_even_on_a_broken_spec(self):
        (self.ap / "state.json").write_text(json.dumps(make_state({"LOOP-F35": "building"})))
        for flag, needle in (("--slack", "*Demo path*"), ("--html", "<h2>Demo path"), ("--json", '"rungs"')):
            out, err = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                code = self.mod.main(["--root", str(self.root), flag, "--now", "2026-09-15T10:00:00Z"])
            self.assertEqual(code, 0, err.getvalue())
            self.assertIn(needle, out.getvalue())
        bad = Path(self.tmp.name) / "bad.json"
        bad.write_text('{"rungs": []}')
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = self.mod.main(["--root", str(self.root), "--spec", str(bad)])
        self.assertEqual(code, 0)
        self.assertIn("demo-path: failed: ValueError: demo-path.json has no rungs", err.getvalue())
        self.assertEqual(out.getvalue(), "")
        self.assertEqual(os.environ.get("DEMO_PATH_SPEC"), None)


if __name__ == "__main__":
    unittest.main()
