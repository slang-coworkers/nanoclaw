#!/usr/bin/env python3
"""Tests for ops/nemoclaw-coworkers/demo_path.py: the spec loads; the board's ONE row derivation
(rows-board.row_state — every fixture record is built through it) gives the documented state (ledger merge
wins over a stale state.json, pause wins over blocked, the supervisor's finer stage wins in flight, one side
in flight is enough, queued-behind-a-gate is `waiting`, no state.json is unknown) and the ADAPTER
rows_from_board is a pure map over the record's canonical fields (the same row comes out with the raw queue /
supervisor / ledger inputs stripped): holds become gate waits (1a → 1a_merged …) or a `held` stall (cost card,
core-change, escalation); the schedule order follows the queue's eligible / waiting lists with held rows last;
live_gating reads only the queue-level facts. compute() gives the expected statuses and ETAs on hand-built
boards (all merged → done with the ledger date; an in-flight BUILD → remaining hours from the stage factor;
queued rows behind a false gate start when the gate's rows finish; a paused row flags the rung and drops out
of the ETA; a blocked or held row inside a gate flags the rungs behind it; a row parked at gate on a merge hold
starts its last slice when the batch it holds for finishes; the BUILD lane serialises BUILD rows; R5 is R4 +
21..35 days); a missing state.json degrades to "unknown" without raising; the real dispatch-plan.md through
rows-board.load_board gives records the tracker consumes, with the ledger's merge stamps; the CLI prints and
exits 0; and the two renderers hold their contracts (Slack ≤ 25 lines with every rung id, HTML with one row
per rung).
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
IN_FLIGHT = ("dispatched", "spec_handoff", "building", "pr_open", "testing", "review", "gate")

# The demo-path rows plus the other batch-2 rows the batch2_merged gate counts (COST-F30, LOOP-F40), in the
# autopilot's dispatch order (hermes_queue.dispatch_order: 1a, 1b by wave, 2, 3, 4, 5, adopt).
ROW_META = {
    "LOOP-F35": ("BUILD", "1a"),
    "RT-F01": ("CONFIGURE", "1b"), "RT-F02": ("CONFIGURE", "1b"), "RT-F03": ("CONFIGURE", "1b"),
    "GOV-F23": ("CONFIGURE", "1b"), "GOV-F27": ("CONFIGURE", "1b"),
    "LOOP-F37": ("BUILD", "2"), "GOV-F24": ("BUILD", "2"), "GOV-F25": ("BUILD", "2"), "COST-F29": ("BUILD", "2"),
    "COST-F30": ("BUILD", "2"), "LOOP-F40": ("CONFIGURE", "2"),
    "CRED-F28": ("BUILD", "3"), "ISO-F13": ("CONFIGURE", "3"), "ISO-F14": ("CONFIGURE", "3"), "ISO-F15": ("CONFIGURE", "3"),
    "A2A-F21": ("CONFIGURE", "4"),
    "FLEET-F62": ("BUILD", "5"),
    "ISO-F17": ("ADOPT", "adopt"),
}
GATES = {"1a": (), "1b": ("1a_first_pass",), "2": ("1a_first_pass",), "3": ("batch2_merged", "podman_box"),
         "4": ("batch2_merged",), "5": ("batch3_merged", "batch4_merged"), "adopt": ("batch3_merged", "batch4_merged")}


def load_module():
    spec = importlib.util.spec_from_file_location("demo_path", HERE / "demo_path.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_BOARD = None


def load_board_module():
    global _BOARD
    if _BOARD is None:
        spec = importlib.util.spec_from_file_location("rows_board_for_demo_tests", HERE / "rows-board.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _BOARD = mod
    return _BOARD


def queue_block(rows: dict, gating: dict, paused: list) -> dict:
    """state.json's `queue` block the way hermes_queue.build_state writes it: queued, unpaused rows in dispatch
    order split into eligible (gates met) and waiting (unmet gates in `blocked_by`); with no BUILD row in flight
    a BUILD row moves to the front (the BUILD lane). Mirrors build_state exactly, quirk included: the loop skips
    index 0, so when the first eligible row is already a BUILD row the NEXT BUILD row is moved ahead of it."""
    eligible, waiting = [], []
    build_in_flight = any(r["state"] in IN_FLIGHT and r["disposition"] == "BUILD" for r in rows.values())
    for rid, (_disp, batch) in ROW_META.items():
        row = rows[rid]
        if row["state"] != "queued" or rid in paused:
            continue
        unmet = [g for g in GATES[batch] if not gating.get(g)]
        if unmet:
            waiting.append({"id": rid, "batch": batch, "blocked_by": unmet, "reason": f"batch {batch}: waits for {', '.join(unmet)}"})
        else:
            eligible.append(rid)
    if not build_in_flight:
        for i, rid in enumerate(eligible):
            if ROW_META[rid][0] == "BUILD" and i > 0:
                eligible.insert(0, eligible.pop(i))
                break
    return {"eligible": eligible, "waiting": waiting}


def make_state(states: dict, gating: dict | None = None, wip: int = 3, supervise: dict | None = None, paused: list | None = None,
               queue: bool = True) -> dict:
    """A state.json in build_state's shape: every ROW_META row queued unless `states` says otherwise, the gate
    flags, the WIP block, the supervisor's rows and (queue=True) the queue block."""
    rows = {}
    for rid, (disp, batch) in ROW_META.items():
        rows[rid] = {"state": states.get(rid, "queued"), "disposition": disp, "batch": batch}
        if rid in (paused or []):
            rows[rid]["paused"] = True
        if states.get(rid) == "blocked":
            rows[rid]["state_reason"] = "cap: test FAIL x2, no round 3 authorized"
    g = {"1a_first_pass": False, "batch2_merged": False, "batch3_merged": False, "batch4_merged": False, "podman_box": True}
    g.update(gating or {})
    in_flight = [r for r, s in states.items() if s in IN_FLIGHT]
    state = {
        "generated_at": GEN, "rows": rows, "gating": g,
        "wip": {"limit": wip, "in_flight": len(in_flight), "free": max(0, wip - len(in_flight)), "build_in_flight": False},
        "supervise": {"rows": supervise or {}},
    }
    if queue:
        state["queue"] = queue_block(rows, g, paused or [])
    return state


def record(rid: str, queue: dict | None = None, sup: dict | None = None, ledger: dict | None = None, plan: dict | None = None,
           config: dict | None = None, state: dict | None = None, state_ok: bool = True) -> dict:
    """A rows-board record in rows-board.build_record's shape, its canonical state derived by the REAL
    rows-board.row_state over the given queue row / supervisor row / ledger row / config / state.json (`state`
    None + state_ok True = a state.json that exists but says nothing about the row; state_ok False = no state.json)."""
    board = load_board_module()
    queue = queue or {}
    sup = sup or {}
    plan = plan if plan is not None else {"batch": ROW_META.get(rid, (None, None))[1], "name": rid}
    st = state if state is not None else ({} if state_ok else None)
    rec = {
        "id": rid, "thread": f"hermes-{rid}", "safe": True, "in_plan": True, "plan": plan, "name": plan.get("name") or "",
        "batch": queue.get("batch") or plan.get("batch"),
        "disposition": (str(queue.get("disposition") or plan.get("plan_disposition") or "").upper() or None),
        "queue": queue, "queue_state": queue.get("state"), "sup": sup, "sup_stage": sup.get("stage"),
        "sessions": {}, "dots": {}, "row_dot": "grey", "cards": {}, "latest": {},
        "ledger": ledger, "merged_at": ledger.get("merged_at") if ledger else None, "carries_open": [],
    }
    rec.update(board.row_state(rid, queue, sup, ledger, config, st))
    rec["stage"] = board.row_stage(rec)
    return rec


def make_records(state: dict | None, merged_at: dict | None = None, config: dict | None = None) -> dict:
    """One record per ROW_META row (the plan rows), in dispatch order, from a state.json dict — the queue row and
    the supervisor row as the board attaches them, config.json's waive / paused_rows — plus a ledger row carrying
    the merge stamp when given."""
    out = {}
    sup_rows = ((state or {}).get("supervise") or {}).get("rows") or {}
    for rid in ROW_META:
        qrow = ((state or {}).get("rows") or {}).get(rid) if state else None
        led = None
        if merged_at and rid in merged_at:
            led = {"dispatched": True, "pr": 2, "outcome": "merged", "merge_sha": "1e3e63f", "reason": None, "gate_red": None, "merged_at": merged_at[rid]}
        out[rid] = record(rid, queue=qrow, sup=sup_rows.get(rid), ledger=led, config=config, state=state, state_ok=state is not None)
    return out


def live_of(state: dict | None, config: dict | None = None, merged_at: dict | None = None, state_err: str | None = None,
            records: dict | None = None, mod=None) -> dict:
    """The tracker's live input the way rows-board's demo_tracker builds it: records → rows_from_board, with
    live_gating over the (already loaded) state.json + config.json objects."""
    mod = mod or load_module()
    gating = mod.live_gating(state, config if config is not None else {}, state_err=state_err)
    return mod.rows_from_board(records if records is not None else make_records(state, merged_at, config), gating)


def by_id(items: list) -> dict:
    return {x["id"]: x for x in items}


def iso(dt: datetime) -> str:
    return dt.isoformat().replace("+00:00", "Z")


class AdapterTest(unittest.TestCase):
    """rows-board.row_state (every fixture record goes through it): the documented derivation; rows_from_board:
    a pure map over the record's canonical fields, disposition / batch fallbacks, holds → gate waits or a stall,
    the schedule order from the queue block, merge stamps from the record; live_gating: the queue-level facts only."""

    def setUp(self):
        self.mod = load_module()
        self.board = load_board_module()

    def gating(self, state, config=None, **kw) -> dict:
        return self.mod.live_gating(state, config if config is not None else {}, **kw)

    def row(self, rec: dict, state: dict | None = None) -> dict:
        state = state if state is not None else make_state({}, gating={"1a_first_pass": True})  # batch-2 rows eligible, not waiting
        live = self.mod.rows_from_board({rec["id"]: rec}, self.gating(state))
        return live["rows"][rec["id"]]

    def test_mapping_table_first_match_wins(self):
        q = {"disposition": "BUILD", "batch": "2"}
        cases = [
            # (queue state, supervisor stage, ledger outcome, expected) — the board's row_state, shown as is by the tracker
            ("review", None, "merged", "merged"),           # the ledger's merge cell wins over a stale queue state
            ("merged", None, None, "merged"),
            ("testing", "merged", None, "merged"),
            ("blocked", None, None, "blocked"),
            ("review", "blocked", None, "blocked"),          # the supervisor's cap
            ("review", None, "blocked", "blocked"),
            ("deferred", None, None, "deferred"),
            ("carried", None, None, "carried"),
            ("testing", "building", None, "building"),       # both in flight: the finer supervisor stage
            ("pr_open", None, None, "pr_open"),
            ("queued", "building", None, "building"),        # only the supervisor sees it in flight (thread evidence, no ledger row yet): in flight
            ("dispatched", "queued", None, "dispatched"),    # only the queue does (dispatch bookkeeping the supervisor has not seen): in flight
            ("queued", "queued", None, "queued"),
            ("queued", None, None, "queued"),
        ]
        for qs, ss, outcome, expected in cases:
            rec = record("GOV-F24", queue=dict(q, state=qs), sup={"stage": ss} if ss else None,
                         ledger={"outcome": outcome, "reason": "STOP — cap", "merged_at": None} if outcome else None)
            self.assertEqual(rec["state"], expected, (qs, ss, outcome))
            self.assertEqual(self.row(rec)["state"], expected, (qs, ss, outcome))
            self.assertEqual(rec["stage"], expected, "the board's cell text is the state, undecorated")
        # pause wins over blocked (and over an in-flight stage); the ledger merge still wins over the pause.
        paused = record("GOV-F24", queue=dict(q, state="blocked", paused=True))
        self.assertEqual((paused["state"], paused["state_reason"]), ("paused", "queue row paused"))
        self.assertEqual(self.row(paused)["state"], "paused")
        self.assertTrue(self.row(paused)["paused"])
        via_config = record("GOV-F24", queue=dict(q, state="building"), config={"paused_rows": ["GOV-F24"]})
        self.assertEqual((via_config["state"], via_config["state_reason"], via_config["stage"]), ("paused", "config.paused_rows", "paused"))
        self.assertEqual(self.row(via_config)["state"], "paused")
        merged_paused = record("GOV-F24", queue=dict(q, state="review", paused=True), ledger={"outcome": "merged", "merged_at": "2026-09-14T00:00:00Z"})
        self.assertEqual(self.row(merged_paused)["state"], "merged")

    def test_adapter_is_a_pure_map_over_the_canonical_fields(self):
        # The same tracker row comes out with the record's raw inputs (queue / sup / ledger / plan) stripped: the
        # adapter never re-derives anything from them.
        rec = record("GOV-F24", queue={"disposition": "BUILD", "batch": "2", "state": "testing", "state_reason": "x"},
                     sup={"stage": "gate", "hold": "1a", "cost_hold": True, "action": "escalate", "alert_kind": "cost-card"},
                     ledger={"outcome": None, "reason": None, "merged_at": None})
        full = self.row(rec)
        stripped = {k: v for k, v in rec.items() if k not in ("queue", "queue_state", "sup", "sup_stage", "ledger", "plan", "stage")}
        self.assertEqual(self.row(stripped), full)
        self.assertEqual(full["state"], "gate")
        self.assertEqual(full["hold_gates"], ("1a_merged",))
        self.assertEqual(full["held"], "cost card pending", "the cost-card escalation is the cost hold, not a second stall")
        self.assertNotIn("board_stage", full)
        self.assertEqual(rec["stage"], "gate · hold 1a · cost hold", "the board shows the same state with its decorations")

    def test_holds_become_gate_waits_or_a_human_needed_stall(self):
        q = {"disposition": "CONFIGURE", "batch": "3", "state": "gate"}
        gate_hold = record("ISO-F13", queue=q, sup={"stage": "gate", "hold": "batch2"})
        self.assertEqual(gate_hold["holds"], [{"kind": "gate", "label": "batch2"}])
        r = self.row(gate_hold)
        self.assertEqual((r["state"], r["hold_gates"], r["held"]), ("gate", ("batch2_merged",), None))
        both = record("ISO-F17", queue=dict(q, batch="adopt"), sup={"stage": "gate", "hold": "batch3+4"})
        self.assertEqual(self.row(both)["hold_gates"], ("batch3_merged", "batch4_merged"))
        core = record("ISO-F13", queue=q, sup={"stage": "gate", "hold": "core-change"})
        self.assertEqual(core["holds"], [{"kind": "hold", "label": "core-change"}])
        self.assertEqual((self.row(core)["held"], self.row(core)["hold_gates"]), ("hold core-change", ()))
        self.assertEqual(core["stage"], "gate · hold core-change")
        slo = record("ISO-F13", queue=dict(q, state="building"), sup={"stage": "building", "action": "escalate", "alert_kind": "slo"})
        self.assertEqual(slo["holds"], [{"kind": "escalated", "label": "slo"}])
        self.assertEqual(self.row(slo)["held"], "escalated (slo)")
        self.assertEqual(slo["stage"], "building", "an escalation is the red dot's business, not the stage text")
        too_long = record("ISO-F13", queue=q, sup={"stage": "gate", "hold": "batch2", "action": "escalate", "alert_kind": "hold-too-long"})
        self.assertEqual(self.row(too_long)["held"], None, "hold-too-long is the gate hold itself, escalated: still a gate wait")
        cost = record("ISO-F13", queue=dict(q, state="review"), sup={"stage": "review", "cost_hold": True})
        self.assertEqual(self.row(cost)["held"], "cost card pending")
        nudged = record("ISO-F13", queue=dict(q, state="review"), sup={"stage": "review", "action": "nudge"})
        self.assertEqual((nudged["holds"], self.row(nudged)["held"]), ([], None), "a nudge is not a hold")
        # Holds ride only on in-flight rows for the model: a merged row's stale hold changes nothing.
        merged = record("ISO-F13", queue=dict(q, state="merged"), sup={"stage": "gate", "hold": "batch2"})
        self.assertEqual(self.row(merged)["state"], "merged")
        # waived is the record's flag; the tracker labels the row `waived` while the board decorates the state.
        waived = record("LOOP-F40", queue={"disposition": "CONFIGURE", "batch": "2", "state": "queued"}, config={"waive": ["LOOP-F40"]})
        self.assertTrue(waived["waived"] and self.row(waived)["waived"])
        self.assertEqual((waived["state"], waived["stage"]), ("queued", "queued · waived"))

    def test_blocked_reason_prefers_the_supervisor_then_the_queue_then_the_ledger(self):
        q = {"disposition": "BUILD", "batch": "2", "state": "blocked", "state_reason": "queue: cap x2"}
        both = record("GOV-F24", queue=q, sup={"stage": "blocked", "reason": "supervisor: PR #5 closed unmerged"}, ledger={"outcome": "blocked", "reason": "STOP — ledger"})
        self.assertEqual(self.row(both)["state_reason"], "supervisor: PR #5 closed unmerged")
        no_sup = record("GOV-F24", queue=q, ledger={"outcome": "blocked", "reason": "STOP — ledger"})
        self.assertEqual(self.row(no_sup)["state_reason"], "queue: cap x2")
        ledger_only = record("GOV-F24", queue={"disposition": "BUILD", "batch": "2", "state": "review"}, ledger={"outcome": "blocked", "reason": "STOP — ledger"})
        self.assertEqual(self.row(ledger_only)["state_reason"], "STOP — ledger")

    def test_waiting_is_a_queued_row_in_the_queues_waiting_list(self):
        state = make_state({"LOOP-F35": "merged"}, gating={"1a_first_pass": True})
        recs = make_records(state)
        self.assertEqual((recs["CRED-F28"]["state"], recs["CRED-F28"]["gates"], recs["CRED-F28"]["stage"]),
                         ("waiting", ("batch2_merged",), "waiting · batch2_merged"), "the board's own state + cell text")
        live = live_of(state, records=recs, mod=self.mod)
        self.assertEqual(live["rows"]["RT-F01"]["state"], "queued", "eligible now")
        self.assertEqual(live["rows"]["CRED-F28"]["state"], "waiting", "behind batch2_merged")
        self.assertEqual(live["rows"]["ISO-F17"]["state"], "waiting")
        self.assertEqual(live["rows"]["LOOP-F35"]["state"], "merged")
        # No queue block: nothing is `waiting` (the board cannot tell), and the fallback is noted.
        live2 = live_of(make_state({"LOOP-F35": "merged"}, gating={"1a_first_pass": True}, queue=False), mod=self.mod)
        self.assertEqual(live2["rows"]["CRED-F28"]["state"], "queued")
        self.assertEqual(live2["order_source"], self.mod.ORDER_SOURCE_BOARD)
        self.assertTrue(any("no queue block" in e for e in live2["source_errors"]), live2["source_errors"])

    def test_unknown_when_state_json_is_missing_or_does_not_know_the_row(self):
        rec = record("GOV-F24", queue=None, ledger={"outcome": "merged", "merged_at": "2026-09-14T00:00:00Z"}, state_ok=False)
        self.assertEqual((rec["state"], rec["state_reason"], rec["stage"]), (None, "state.json unavailable", ""), "no state.json: the board shows nothing either")
        live = self.mod.rows_from_board({"GOV-F24": rec}, self.mod.live_gating(None, None, state_err="state.json not found"))
        self.assertFalse(live["state_ok"])
        self.assertEqual(live["rows"]["GOV-F24"]["state"], "unknown")
        self.assertEqual(live["rows"]["GOV-F24"]["state_reason"], "state.json unavailable")
        self.assertEqual(live["order"], [], "unknown rows are never scheduled")
        self.assertIn("state.json not found", live["source_errors"])
        self.assertIn("config.json not found; defaults (wip 3, nothing waived or paused)", live["source_errors"])
        # state.json present, row absent from it (a card thread that is not a matrix row).
        state = make_state({})
        live = self.mod.rows_from_board({"P0-LOOP": record("P0-LOOP", queue=None, plan={}, state=state)}, self.gating(state))
        self.assertEqual(live["rows"]["P0-LOOP"]["state"], "unknown")
        self.assertEqual(live["rows"]["P0-LOOP"]["state_reason"], "not in state.json")
        self.assertEqual(live["merged_at"], {})
        # …unless the ledger has a verdict on it, or the supervisor knows it: those are facts about the row.
        self.assertEqual(record("P0-LOOP", queue=None, plan={}, state=state, ledger={"outcome": "merged", "merged_at": None})["state"], "merged")
        self.assertEqual(record("P0-LOOP", queue=None, plan={}, state=state, sup={"stage": "review"})["state"], "review")

    def test_disposition_and_batch_fall_back_to_the_plan_row(self):
        rec = record("RT-F01", queue={"state": "queued"}, plan={"batch": "1b", "name": "x", "plan_disposition": "CONFIGURE", "wave": 1})
        row = self.row(rec)
        self.assertEqual((row["disposition"], row["batch"]), ("CONFIGURE", "1b"))
        rec2 = record("RT-F01", queue={"state": "queued", "disposition": "build", "batch": "2"}, plan={"batch": "1b", "plan_disposition": "CONFIGURE"})
        row2 = self.row(rec2)
        self.assertEqual((row2["disposition"], row2["batch"]), ("BUILD", "2"), "the queue row wins; dispositions are upper-cased")
        self.assertIsNone(self.row(record("RT-F01", queue={"state": "queued"}, plan={}))["disposition"], "compute() falls back to the spec kind")

    def test_order_is_placed_rows_then_eligible_then_waiting_with_their_gates(self):
        state = make_state({"LOOP-F35": "merged", "LOOP-F37": "pr_open", "COST-F30": "blocked"}, gating={"1a_first_pass": True}, paused=["GOV-F25"])
        live = live_of(state, mod=self.mod)
        order = live["order"]
        ids = [rid for rid, _ in order]
        self.assertEqual(live["order_source"], self.mod.ORDER_SOURCE_QUEUE)
        placed = ["LOOP-F35", "LOOP-F37", "GOV-F25", "COST-F30"]  # merged, in flight, paused, blocked — board (dispatch) order
        self.assertEqual(ids[:4], placed)
        eligible = state["queue"]["eligible"]
        self.assertEqual(ids[4:4 + len(eligible)], eligible)
        self.assertEqual(eligible[:5], ["RT-F01", "RT-F02", "RT-F03", "GOV-F23", "GOV-F27"], "1b first; a BUILD is in flight, so no BUILD-lane move")
        gates = dict(order)
        self.assertEqual(gates["CRED-F28"], ("batch2_merged",), "podman_box is true: only the unmet gate is carried")
        self.assertEqual(gates["ISO-F17"], ("batch3_merged", "batch4_merged"))
        self.assertEqual(gates["RT-F01"], ())
        self.assertEqual(len(ids), len(set(ids)), "every row once")
        self.assertEqual(set(ids), set(ROW_META))
        # Nothing in flight: build_state moves the first eligible BUILD row to the front, and so does the schedule.
        state2 = make_state({"LOOP-F35": "merged"}, gating={"1a_first_pass": True})
        self.assertEqual(state2["queue"]["eligible"][0], "LOOP-F37")
        ids2 = [rid for rid, _ in live_of(state2, mod=self.mod)["order"]]
        self.assertEqual(ids2[:2], ["LOOP-F35", "LOOP-F37"])

    def test_merged_at_comes_from_the_records_ledger_row_for_merged_rows_only(self):
        state = make_state({"LOOP-F35": "merged", "LOOP-F37": "review"})
        recs = make_records(state, merged_at={"LOOP-F35": "2026-09-10T21:43:00Z"})
        # a stamp in a cell that is not a merge is ignored
        recs["LOOP-F37"] = record("LOOP-F37", queue=state["rows"]["LOOP-F37"], state=state,
                                  ledger={"outcome": None, "reason": None, "merge_sha": None, "merged_at": "2026-09-11T00:00:00Z"})
        live = live_of(state, records=recs, mod=self.mod)
        self.assertEqual(live["merged_at"], {"LOOP-F35": "2026-09-10T21:43:00Z"})
        self.assertEqual(live["rows"]["LOOP-F37"]["state"], "review")

    def test_live_gating_reads_only_the_queue_level_facts(self):
        state = make_state({"LOOP-F35": "merged"}, gating={"1a_first_pass": True}, wip=4)
        g = self.gating(state, {"wip": 2, "waive": ["LOOP-F40"], "paused_rows": ["GOV-F25"]})
        self.assertEqual((g["wip_limit"], g["waive"], g["paused_rows"]), (2, ["LOOP-F40"], ["GOV-F25"]), "config.json wins over state.json's limit")
        self.assertEqual(g["gating"]["1a_first_pass"], True)
        self.assertTrue(g["state_ok"] and g["queue_ok"])
        self.assertEqual(g["generated_at"], GEN)
        self.assertEqual(g["eligible"], state["queue"]["eligible"])
        self.assertEqual(dict(g["waiting"])["CRED-F28"], ("batch2_merged",))
        self.assertEqual(g["errors"], [])
        self.assertNotIn("rows", g, "row state never travels through the gating dict")
        g2 = self.mod.live_gating(state, None)
        self.assertEqual(g2["wip_limit"], 4)
        self.assertIn("config.json not found", g2["errors"][0])
        g3 = self.mod.live_gating(None, {"wip": "many"}, state_err="state.json unreadable: x", config_err="config.json is not an object", ledger_err="ledger.md not found (p)")
        self.assertEqual(g3["wip_limit"], 3)
        self.assertEqual(g3["errors"], ["state.json unreadable: x", "config.json is not an object", "ledger.md not found (p); done dates fall back to state.json"])
        self.assertFalse(g3["state_ok"])
        # The waived list may also come from the gating block when config.json has none.
        state["gating"]["waived"] = ["RT-F03"]
        self.assertEqual(self.gating(state, {})["waive"], ["RT-F03"])


class ComputeTest(unittest.TestCase):
    def setUp(self):
        self.mod = load_module()
        self.spec = self.mod.load_spec()

    def live(self, *args, **kw) -> dict:
        return live_of(*args, mod=self.mod, **kw)

    def rungs(self, live: dict, now: datetime = NOW) -> dict:
        return by_id(self.mod.compute(self.spec, live, now)["rungs"])

    def test_a_follow_up_record_is_mapped_but_never_takes_a_simulated_slot(self):
        """hermes_queue gives a `<PARENT>.<letter>` follow-up no WIP slot and the board shows it in its own section; the
        tracker must not schedule it either, or every plan row behind it slips by a slot's worth of hours (RT-F01's start
        moved +12.75 h when a dispatched SCHED-F34.a took a simulated slot)."""
        state = make_state({"LOOP-F35": "testing"}, gating={"1a_first_pass": True}, wip=2)
        recs = make_records(state)
        fu = record("SCHED-F34.a", queue={"state": "dispatched", "disposition": "CONFIGURE", "batch": "1b"},
                    plan={"batch": "1b", "name": "follow-up of SCHED-F34: TZ"}, state=state)
        fu["follow_up"] = {"parent": "SCHED-F34"}
        with_fu = self.live(state, records={**recs, "SCHED-F34.a": fu})
        without = self.live(state, records=recs)
        self.assertEqual((with_fu["rows"]["SCHED-F34.a"]["state"], with_fu["rows"]["SCHED-F34.a"]["follow_up"]), ("dispatched", True))
        self.assertFalse(without["rows"]["LOOP-F35"]["follow_up"])
        self.assertEqual(with_fu["order"], without["order"])
        self.assertNotIn("SCHED-F34.a", [rid for rid, _ in with_fu["order"]])
        a, b = self.rungs(with_fu), self.rungs(without)
        rows_a, rows_b = by_id(a["R1"]["rows"]), by_id(b["R1"]["rows"])
        self.assertEqual(rows_a["RT-F01"]["start_utc"], iso(NOW), "the one free slot (wip 2, LOOP-F35 testing) is RT-F01's now")
        self.assertEqual({r: (v.get("start_utc"), v.get("eta")) for r, v in rows_a.items()},
                         {r: (v.get("start_utc"), v.get("eta")) for r, v in rows_b.items()})
        self.assertEqual((a["R1"]["eta_utc"], a["R1"]["status"]), (b["R1"]["eta_utc"], b["R1"]["status"]))

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
        # FLEET-F62 is a plan row (batch 5, BUILD) since 2026-09-16 — no longer a manual step; ISO-F17's proof runs against its boot
        self.assertEqual([(x["id"], x["kind"], x["after"]) for x in r4["rows"]], [("FLEET-F62", "BUILD", []), ("ISO-F17", "ADOPT", ["FLEET-F62"])])
        self.assertEqual([(m["id"], m["hours"], m["after"]) for m in r4["manual"]], [("P6-OPERATOR", 8.0, ["R2", "R3"])],
                         "the operator's box-side steps (mounts, egress rule, OneCLI agents) stay as ONE manual item")
        self.assertNotIn("P6-FLEET", json.dumps(self.spec))
        r5 = by_id(self.spec["rungs"])["R5"]
        self.assertEqual((r5["manual"][0]["hours"], r5["manual"][0]["hours_max"]), (504.0, 840.0))
        self.assertIn("planning_hours", self.spec["notes"])

    def test_all_merged_is_done_with_the_ledger_merge_date(self):
        states = {rid: "merged" for rid in ROW_META}
        merged_at = {rid: "2026-09-12T08:00:00Z" for rid in ROW_META}
        merged_at["COST-F29"] = "2026-09-14T21:43:00Z"  # the last R1 row to land
        rungs = self.rungs(self.live(make_state(states), merged_at=merged_at))
        r1 = rungs["R1"]
        self.assertEqual(r1["status"], "done")
        self.assertEqual(r1["done_at"], "2026-09-14T21:43:00Z", "done date = the latest ledger merge stamp among the rung's rows")
        self.assertEqual(r1["hours_remaining"], 0.0)
        self.assertTrue(all(r["done"] and r["label"] == "merged" for r in r1["rows"]))
        self.assertEqual(r1["rows"][0]["done_at"], "2026-09-12T08:00:00Z")
        # R3 has a manual step with no done_at: rows merged, but the rung is not done and its ETA is the manual item.
        r3 = rungs["R3"]
        self.assertEqual(r3["status"], "in_progress")
        self.assertEqual(r3["eta_utc"], iso(NOW + 8 * H))
        self.assertEqual(r3["manual"][0]["eta"], r3["eta_utc"])

    def test_manual_done_at_completes_the_rung(self):
        spec = json.loads(json.dumps(self.spec))
        for rung in spec["rungs"]:
            for m in rung["manual"]:
                m["done_at"] = "2026-09-14T00:00:00Z"
        states = {rid: "merged" for rid in ROW_META}
        rungs = by_id(self.mod.compute(spec, self.live(make_state(states)), NOW)["rungs"])
        self.assertEqual([rungs[r]["status"] for r in ("R1", "R2", "R3", "R4", "R5")], ["done"] * 5)
        # No ledger stamps: the done date falls back to state.json's generated_at (rows) / done_at (manual).
        self.assertEqual(rungs["R1"]["done_at"], GEN)

    def test_in_flight_build_row_remaining_hours_from_the_stage_factor(self):
        state = make_state({"LOOP-F35": "merged", "LOOP-F37": "pr_open"}, gating={"1a_first_pass": True},
                           supervise={"LOOP-F37": {"stage": "building"}})
        rungs = self.rungs(self.live(state, merged_at={"LOOP-F35": "2026-09-10T21:43:00Z"}))
        r1 = rungs["R1"]
        self.assertEqual(r1["status"], "in_progress")
        rows = by_id(r1["rows"])
        f37 = rows["LOOP-F37"]
        self.assertEqual(f37["state"], "building", "the supervisor's finer stage wins while the row is in flight")
        self.assertEqual(f37["remaining_hours"], 28.8)
        self.assertEqual(f37["start_utc"], iso(NOW))
        self.assertEqual(f37["eta"], iso(NOW + 28.8 * H))
        self.assertTrue(f37["in_flight"])
        # List schedule on 3 slots in the queue's order: RT-F01 / RT-F02 take the two free slots now (15 h each), RT-F03 and
        # GOV-F23 follow at +15 h, GOV-F27 at +28.8 h when LOOP-F37's slot frees; GOV-F24, the next BUILD, takes the
        # first free slot at +30 h (the lane is free from +28.8 h), then GOV-F25 and COST-F29 follow one at a time.
        self.assertEqual(rows["RT-F01"]["start_utc"], iso(NOW))
        self.assertEqual(rows["RT-F02"]["start_utc"], iso(NOW))
        self.assertEqual(rows["RT-F03"]["start_utc"], iso(NOW + 15 * H))
        self.assertEqual(rows["GOV-F27"]["start_utc"], iso(NOW + 28.8 * H))
        self.assertEqual(rows["GOV-F24"]["start_utc"], iso(NOW + 30 * H))
        self.assertEqual(rows["GOV-F25"]["start_utc"], iso(NOW + 78 * H), "BUILD lane: after GOV-F24")
        self.assertEqual(rows["COST-F29"]["start_utc"], iso(NOW + 126 * H))
        self.assertEqual(r1["eta_utc"], iso(NOW + 174 * H))
        self.assertEqual(r1["hours_remaining"], 174.0)
        self.assertEqual(r1["eta_date"], "2026-09-22")
        self.assertEqual(rows["LOOP-F35"]["done_at"], "2026-09-10T21:43:00Z", "the record's ledger stamp")

    def test_queued_rows_behind_a_false_gate_start_after_the_gate_rows_finish(self):
        # Batch 1b all merged, batch 2 all queued but LOOP-F37 in review: batch2_merged is false, so batch 3 / 4
        # rows (R2, R3) are `waiting` and start when the last batch-2 row finishes; podman_box true.
        states = {rid: "merged" for rid, (_d, b) in ROW_META.items() if b in ("1a", "1b")}
        states["LOOP-F37"] = "review"
        state = make_state(states, gating={"1a_first_pass": True}, wip=3)
        rungs = self.rungs(self.live(state))
        r1, r2, r3 = rungs["R1"], rungs["R2"], rungs["R3"]
        self.assertEqual(r1["status"], "in_progress")
        # Batch 2 (BUILD lane): F37 review 9.6 h, then GOV-F24, GOV-F25, COST-F29, COST-F30 (48 h each), LOOP-F40 15 h in parallel.
        batch2_end = NOW + (9.6 + 4 * 48) * H
        self.assertEqual(by_id(r1["rows"])["COST-F29"]["eta"], iso(NOW + (9.6 + 3 * 48) * H))
        self.assertEqual(r2["status"], "blocked_by_gate")
        self.assertEqual(r2["gates"], ["batch2_merged"])
        cred = by_id(r2["rows"])["CRED-F28"]
        self.assertEqual(cred["state"], "waiting")
        self.assertEqual(cred["label"], "waiting")
        self.assertEqual(cred["remaining_hours"], 48.0, "waiting = queued: the full planning hours")
        self.assertEqual(cred["start_utc"], iso(batch2_end), "the gate opens when COST-F30, the last batch-2 row, finishes")
        self.assertIn("waits for batch2_merged", cred["blockers"])
        self.assertEqual(r2["eta_utc"], iso(batch2_end + 48 * H))
        self.assertEqual(r3["status"], "blocked_by_gate")
        a2a = by_id(r3["rows"])["A2A-F21"]
        self.assertGreaterEqual(a2a["start_utc"], cred["start_utc"])
        rooms = r3["manual"][0]
        self.assertEqual(rooms["eta"], iso(datetime.fromisoformat(a2a["eta"].replace("Z", "+00:00")) + 8 * H),
                         "the manual rooms step starts when A2A-F21 finishes")
        self.assertEqual(r3["eta_utc"], rooms["eta"])
        # R4: FLEET-F62 (batch 5, BUILD 48 h) waits for batch3_merged + batch4_merged, i.e. CRED-F28's finish (= R2's ETA,
        # later than R3's), and takes the BUILD lane right then; ISO-F17 (after FLEET-F62) ends 10 h later; the operator's
        # 8 h manual step runs after R2 + R3 in parallel and never extends the rung; R5 = R4 + 21..35 d.
        r4, r5 = rungs["R4"], rungs["R5"]
        self.assertEqual(r4["status"], "blocked_by_gate")
        r2r3 = max(datetime.fromisoformat(r2["eta_utc"].replace("Z", "+00:00")), datetime.fromisoformat(r3["eta_utc"].replace("Z", "+00:00")))
        fleet = by_id(r4["rows"])["FLEET-F62"]
        self.assertEqual((fleet["state"], fleet["kind"], fleet["remaining_hours"]), ("waiting", "BUILD", 48.0))
        self.assertIn("waits for batch3_merged, batch4_merged", fleet["blockers"])
        self.assertEqual(fleet["start_utc"], iso(r2r3), "the gate opens when CRED-F28, the last batch-3 row, finishes")
        self.assertEqual(fleet["eta"], iso(r2r3 + 48 * H))
        self.assertEqual(by_id(r4["rows"])["ISO-F17"]["eta"], iso(r2r3 + 58 * H))
        ops = r4["manual"][0]
        self.assertEqual((ops["id"], ops["eta"]), ("P6-OPERATOR", iso(r2r3 + 8 * H)))
        self.assertEqual(r4["eta_utc"], by_id(r4["rows"])["ISO-F17"]["eta"])
        self.assertGreater(r4["eta_utc"], fleet["eta"])
        r4_eta = datetime.fromisoformat(r4["eta_utc"].replace("Z", "+00:00"))
        self.assertEqual(r5["eta_utc"], iso(r4_eta + timedelta(days=21)))
        self.assertEqual(r5["eta_max_utc"], iso(r4_eta + timedelta(days=35)))
        self.assertEqual(r5["status"], "blocked_by_gate")

    def test_podman_box_false_makes_batch3_unknown_with_the_reason(self):
        states = {rid: "merged" for rid, (_d, b) in ROW_META.items() if b in ("1a", "1b", "2")}
        state = make_state(states, gating={"1a_first_pass": True, "batch2_merged": True, "podman_box": False})
        rungs = self.rungs(self.live(state))
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
        rungs = self.rungs(self.live(state, config=cfg))
        r1 = rungs["R1"]
        rows = by_id(r1["rows"])
        self.assertEqual(rows["GOV-F25"]["label"], "paused")
        self.assertIsNone(rows["GOV-F25"]["eta"])
        self.assertEqual(r1["flags"], ["blocked by pause: GOV-F25"])
        self.assertIsNotNone(r1["eta_utc"], "the ETA is computed over the other rows")
        # Nothing in flight, so the queue puts LOOP-F37 (the first BUILD) at the front of `eligible` — the schedule
        # follows the queue: LOOP-F37 [0, 48] holds the lane while the five 1b CONFIGURE rows share the other two
        # slots (RT-F01/F02 at 0 h, RT-F03/GOV-F23 at 15 h, GOV-F27 at 30 h); then GOV-F24 [48, 96] → COST-F29 [96, 144];
        # GOV-F25 (paused) is skipped, not waited for.
        self.assertEqual(rows["LOOP-F37"]["start_utc"], iso(NOW))
        self.assertEqual(rows["GOV-F24"]["start_utc"], iso(NOW + 48 * H))
        self.assertEqual(r1["eta_utc"], iso(NOW + 144 * H))
        self.assertEqual(r1["status"], "in_progress")
        # Unpaused, the lane has four BUILDs and the ETA moves out by one: the pause is what the flag explains.
        r1u = self.rungs(self.live(state, config={"wip": 3}))["R1"]
        self.assertEqual(r1u["eta_utc"], iso(NOW + 192 * H))
        self.assertEqual(r1u["flags"], [])
        # The paused row is inside the batch2_merged gate too: R2 gets the pause flag through the gate.
        self.assertTrue(any(f.startswith("blocked by pause: GOV-F25 paused in gate batch2_merged") for f in rungs["R2"]["flags"]), rungs["R2"]["flags"])
        # A row paused on the queue row itself (build_state's `paused`) reads the same.
        state2 = make_state({"LOOP-F35": "merged"}, gating={"1a_first_pass": True}, paused=["GOV-F25"])
        self.assertEqual(self.rungs(self.live(state2))["R1"]["flags"], ["blocked by pause: GOV-F25"])

    def test_blocked_row_is_a_blocker_and_waived_row_counts_as_done(self):
        state = make_state({"LOOP-F35": "merged", "COST-F30": "blocked"}, gating={"1a_first_pass": True})
        cfg = {"wip": 3, "waive": ["LOOP-F40", "RT-F03"]}
        rungs = self.rungs(self.live(state, config=cfg))
        r1 = rungs["R1"]
        rows = by_id(r1["rows"])
        self.assertEqual(rows["RT-F03"]["label"], "waived")
        self.assertTrue(rows["RT-F03"]["done"])
        self.assertEqual(r1["flags"], [])
        self.assertTrue(any(b.startswith("COST-F30 blocked in gate batch2_merged") for b in rungs["R2"]["blockers"]), rungs["R2"]["blockers"])
        self.assertIsNotNone(rungs["R2"]["eta_utc"], "a blocked row inside the gate is excluded from the gate's finish time, not fatal")
        # A rung whose own row is blocked: the row's reason is a rung blocker and the rung's ETA is unknown.
        state2 = make_state({"LOOP-F35": "merged", "GOV-F24": "blocked"}, gating={"1a_first_pass": True})
        r1b = self.rungs(self.live(state2))["R1"]
        self.assertIsNone(r1b["eta_utc"])
        self.assertEqual(r1b["blockers"], ["GOV-F24 blocked — cap: test FAIL x2, no round 3 authorized"])
        # The ledger's blocked cell on the record blocks the row the same way, with the ledger's reason.
        state3 = make_state({"LOOP-F35": "merged"}, gating={"1a_first_pass": True})
        recs = make_records(state3)
        recs["GOV-F24"] = record("GOV-F24", queue=state3["rows"]["GOV-F24"], state=state3,
                                 ledger={"outcome": "blocked", "reason": "STOP — operator hold", "merge_sha": None, "merged_at": None})
        self.assertEqual(recs["GOV-F24"]["stage"], "blocked", "the board cell says so too")
        r1c = self.rungs(self.live(state3, records=recs))["R1"]
        self.assertEqual(r1c["blockers"], ["GOV-F24 blocked — STOP — operator hold"])

    def test_held_rows_wait_for_their_gate_or_stall_the_rung(self):
        # GOV-F24 (batch 2, BUILD) is parked at `gate` on a 1a merge hold while LOOP-F35 (batch 1a) is still in review:
        # its last 0.1 slice starts when LOOP-F35 finishes (48 × 0.2 = 9.6 h), not now; the rung's ETA follows.
        state = make_state({"LOOP-F35": "review", "GOV-F24": "gate"}, gating={"1a_first_pass": True},
                           supervise={"GOV-F24": {"stage": "gate", "hold": "1a"}, "LOOP-F35": {"stage": "review"}})
        recs = make_records(state)
        self.assertEqual(recs["GOV-F24"]["stage"], "gate · hold 1a")
        live = self.live(state, records=recs)
        self.assertEqual([rid for rid, _ in live["order"]][-1], "GOV-F24", "a held row is scheduled last, after its gate's rows")
        self.assertEqual(dict(live["order"])["GOV-F24"], ("1a_merged",))
        r1 = self.rungs(live)["R1"]
        rows = by_id(r1["rows"])
        f24 = rows["GOV-F24"]
        self.assertEqual((f24["state"], f24["label"], f24["in_flight"], f24["stalled"]), ("gate", "gate", True, None))
        self.assertEqual(f24["remaining_hours"], 4.8)
        self.assertEqual(f24["start_utc"], iso(NOW + 9.6 * H), "the hold lifts when LOOP-F35 (the 1a gate) finishes")
        self.assertEqual(f24["eta"], iso(NOW + 14.4 * H))
        self.assertEqual(f24["blockers"], ["waits for 1a_merged"])
        self.assertIn("1a_merged", r1["gates"])
        self.assertEqual(r1["status"], "in_progress")
        self.assertIsNotNone(r1["eta_utc"])
        # The held row keeps its WIP slot (busy until +14.4 h beside LOOP-F35's +9.6 h) and the BUILD lane (free at +14.4 h).
        # The five 1b CONFIGURE rows take the slots first (RT-F01 [0,15], RT-F02 [9.6,24.6], RT-F03 [14.4,29.4],
        # GOV-F23 [15,30], GOV-F27 [24.6,39.6]); LOOP-F37, the next BUILD, starts at the first free slot after the lane opens.
        self.assertEqual(rows["LOOP-F37"]["start_utc"], iso(NOW + 29.4 * H))
        self.assertGreaterEqual(rows["LOOP-F37"]["start_utc"], f24["eta"], "the lane is held until GOV-F24 merges")
        # The same row on a cost card instead: a human-needed stall — no ETA for it, the rung is flagged, still in progress.
        state2 = make_state({"LOOP-F35": "merged", "GOV-F24": "gate"}, gating={"1a_first_pass": True, "1a_merged": True},
                            supervise={"GOV-F24": {"stage": "gate", "cost_hold": True}})
        recs2 = make_records(state2, merged_at={"LOOP-F35": "2026-09-10T21:43:00Z"})
        self.assertEqual(recs2["GOV-F24"]["stage"], "gate · cost hold")
        r1b = self.rungs(self.live(state2, records=recs2))["R1"]
        f24b = by_id(r1b["rows"])["GOV-F24"]
        self.assertEqual((f24b["label"], f24b["stalled"], f24b["in_flight"], f24b["eta"]), ("gate", "held", False, None))
        self.assertEqual(f24b["blockers"], ["held — cost card pending"])
        self.assertEqual(r1b["blockers"], ["GOV-F24 held — cost card pending"])
        self.assertIsNone(r1b["eta_utc"], "a held row has no finish time, so neither has its rung")
        self.assertEqual(r1b["status"], "in_progress", "a held row is still an in-flight row for the rung's status")
        # …and inside a gate: the rungs behind it see the stall through the gate, like a blocked row.
        r2b = self.rungs(self.live(state2, records=recs2))["R2"]
        self.assertTrue(any(b.startswith("GOV-F24 held in gate batch2_merged") for b in r2b["blockers"]), r2b["blockers"])
        self.assertIn("dp-row stalled", self.mod.render_html(self.mod.compute(self.spec, self.live(state2, records=recs2), NOW)))

    def test_wip_limit_and_more_in_flight_than_the_limit(self):
        # Five CONFIGURE rows in flight on a limit of 3: the first eligible row starts only when running drops below 3.
        states = {"LOOP-F35": "merged", "RT-F01": "dispatched", "RT-F02": "dispatched", "RT-F03": "dispatched", "GOV-F23": "dispatched", "GOV-F27": "dispatched"}
        state = make_state(states, gating={"1a_first_pass": True})
        # build_state's BUILD-lane move skips index 0: LOOP-F37 already leads, so GOV-F24 (the next BUILD) is moved ahead of
        # it — that is the order the dispatch tick sends, and the tracker follows the queue rather than re-deriving it.
        self.assertEqual(state["queue"]["eligible"][:3], ["GOV-F24", "LOOP-F37", "GOV-F25"])
        rows = by_id(self.rungs(self.live(state, config={"wip": 3}))["R1"]["rows"])
        inflight_end = NOW + 15 * 0.85 * H
        self.assertEqual(rows["GOV-F24"]["start_utc"], iso(inflight_end))
        self.assertEqual(rows["LOOP-F37"]["start_utc"], iso(inflight_end + 48 * H), "the BUILD lane: after GOV-F24")
        # wip from config.json wins over state.json's limit; at 7, two slots are free beside the five in flight.
        res = self.mod.compute(self.spec, self.live(state, config={"wip": 7}), NOW)
        self.assertEqual(res["wip_limit"], 7)
        rows7 = by_id(by_id(res["rungs"])["R1"]["rows"])
        self.assertEqual(rows7["GOV-F24"]["start_utc"], iso(NOW), "two free slots at limit 7")

    def test_not_started_when_a_row_is_queued_and_eligible(self):
        # Nothing dispatched yet: LOOP-F35 is eligible now, so R1 is "not started" (the rest of its rows wait for
        # 1a_first_pass, which LOOP-F35 itself opens); R2..R4 have nothing eligible and wait on gates.
        state = make_state({}, gating={"1a_first_pass": False})
        rungs = self.rungs(self.live(state))
        self.assertEqual(rungs["R1"]["status"], "not_started")
        self.assertIsNotNone(rungs["R1"]["eta_utc"])
        self.assertEqual(by_id(rungs["R1"]["rows"])["LOOP-F37"]["blockers"], ["waits for 1a_first_pass"])
        rows = by_id(rungs["R1"]["rows"])
        self.assertEqual(rows["LOOP-F35"]["state"], "queued")
        self.assertEqual(rows["LOOP-F37"]["state"], "waiting")
        self.assertEqual(rows["RT-F01"]["start_utc"], iso(NOW + 48 * H), "1a_first_pass opens when LOOP-F35 finishes; the first 1b row starts right then")
        self.assertEqual(rows["LOOP-F37"]["start_utc"], iso(NOW + 63 * H),
                         "the five 1b CONFIGURE rows precede it in the queue's waiting order and hold all three slots until +63 h")
        self.assertEqual([rungs[r]["status"] for r in ("R2", "R3", "R4", "R5")], ["blocked_by_gate"] * 4)

    def test_missing_state_renders_unknown_without_raising(self):
        res = self.mod.compute(self.spec, self.live(None, state_err="state.json not found"), NOW)
        self.assertFalse(res["state_ok"])
        self.assertIn("state.json not found", res["source_errors"])
        for rung in res["rungs"]:
            self.assertEqual(rung["status"], "unknown", rung["id"])
            self.assertIsNone(rung["eta_utc"])
            self.assertTrue(all(r["state"] == "unknown" and r["label"] == "unknown" for r in rung["rows"]))
        r1 = by_id(res["rungs"])["R1"]
        self.assertEqual(len(r1["blockers"]), 1, "unknown rows are collapsed into one line per reason")
        self.assertTrue(r1["blockers"][0].startswith("state.json unavailable: LOOP-F35, LOOP-F37"))
        # A board that knows only some rows: the missing ones are unknown, the rung's ETA unknown; a state.json that
        # knows only some rows and has no queue block: board order, "not in state.json" for the rest.
        partial = {"generated_at": GEN, "rows": {"LOOP-F35": {"state": "building", "disposition": "BUILD", "batch": "1a"}}, "gating": {}, "wip": {"limit": 3}}
        recs = {"LOOP-F35": record("LOOP-F35", queue=partial["rows"]["LOOP-F35"], state=partial), "LOOP-F37": record("LOOP-F37", queue=None, state=partial)}
        res2 = self.mod.compute(self.spec, self.live(partial, records=recs), NOW)
        r1 = by_id(res2["rungs"])["R1"]
        self.assertEqual(r1["status"], "in_progress")
        self.assertIsNone(r1["eta_utc"])
        self.assertEqual(res2["order_source"], self.mod.ORDER_SOURCE_BOARD)
        self.assertEqual(by_id(r1["rows"])["LOOP-F37"]["blockers"], ["not in state.json"])
        self.assertEqual(by_id(r1["rows"])["GOV-F24"]["blockers"], ["not on the rows board (not a plan row)"])
        self.assertIn("not on the rows board (not a plan row): GOV-F24, GOV-F25", " ".join(r1["blockers"]))

    def test_render_slack_contract(self):
        for live in (self.live(make_state({"LOOP-F35": "merged", "LOOP-F37": "building"}, gating={"1a_first_pass": True})),
                     self.live(None, state_err="state.json not found"),
                     self.live(make_state({rid: "merged" for rid in ROW_META}))):
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
        text = self.mod.render_slack(self.mod.compute(self.spec, self.live(make_state({"LOOP-F35": "merged", "LOOP-F37": "building"}, gating={"1a_first_pass": True})), NOW))
        self.assertIn("LOOP-F37 building", text)
        self.assertIn("CRED-F28 waiting", text)
        self.assertIn("*in progress*", text)
        self.assertIn("ETA 2026-", text)
        self.assertIn("to 2026-", text, "R5 renders as a date range")

    def test_render_slack_caps_at_25_lines_with_many_flags(self):
        spec = json.loads(json.dumps(self.spec))
        spec["rungs"] = spec["rungs"] * 4  # 20 rungs → far more than 25 candidate lines
        text = self.mod.render_slack(self.mod.compute(spec, self.live(make_state({})), NOW))
        self.assertEqual(len(text.split("\n")), 25)
        self.assertTrue(text.split("\n")[-1].startswith("_model:"), "the footer survives truncation")

    def test_render_html_contract(self):
        res = self.mod.compute(self.spec, self.live(make_state({"LOOP-F35": "merged", "LOOP-F37": "building", "COST-F30": "blocked"},
                                                               gating={"1a_first_pass": True}), config={"paused_rows": ["LOOP-F40"]}), NOW)
        frag = self.mod.render_html(res)
        self.assertTrue(frag.lstrip().startswith("<style>"))
        self.assertIn("<h2>Demo path", frag)
        self.assertNotIn("<html", frag, "a fragment, not a page")
        for rid in ("R1", "R2", "R3", "R4", "R5"):
            self.assertIn(f"<b>{rid}</b>", frag)
        self.assertIn("LOOP-F37 · building", frag)
        self.assertIn("CRED-F28 · waiting", frag)
        self.assertIn('class="dp-row queued"', frag, "a waiting row wears the queued chip")
        self.assertIn("dp-row merged", frag)
        self.assertIn("blocked by pause: LOOP-F40 paused in gate batch2_merged", frag)
        self.assertIn("COST-F30 blocked in gate batch2_merged", frag)
        self.assertIn("ETA model", frag)
        self.assertIn("rows board", frag, "the page says where the row states come from")
        self.assertIn("&lt;-", frag, "the notes are HTML-escaped")
        # The text of a blocker reason is escaped end to end.
        state = make_state({"LOOP-F35": "merged", "GOV-F24": "blocked"}, gating={"1a_first_pass": True})
        state["rows"]["GOV-F24"]["state_reason"] = "<script>alert(1)</script> & co"
        frag = self.mod.render_html(self.mod.compute(self.spec, self.live(state), NOW))
        self.assertNotIn("<script>", frag)
        self.assertIn("&lt;script&gt;", frag)

    def test_result_is_json_serialisable_and_deterministic(self):
        live = self.live(make_state({"LOOP-F35": "merged", "LOOP-F37": "building"}, gating={"1a_first_pass": True}))
        a = json.dumps(self.mod.compute(self.spec, live, NOW), sort_keys=True)
        b = json.dumps(self.mod.compute(self.spec, live, NOW), sort_keys=True)
        self.assertEqual(a, b)


class BoardIntegrationTest(unittest.TestCase):
    """The tracker over rows-board.load_board's real records: a temp checkout with the real dispatch-plan.md, a
    state.json (with its queue block), config.json and a ledger; every missing file degrades to an error string,
    never an exception; the CLI prints and exits 0."""

    def setUp(self):
        self.mod = load_module()
        self.board = load_board_module()
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "checkout"
        self.ap = self.root / "data" / "shared" / "hermes" / "autopilot"
        self.ap.mkdir(parents=True)

    def tearDown(self):
        self.tmp.cleanup()

    def live_from_board(self, **kw) -> dict:
        board = self.board.load_board(str(self.root), NOW, **kw)
        gating = self.mod.live_gating(board["state"], board["config"], state_err=board["state_err"], config_err=board["config_err"],
                                      ledger_err=board["tables"].get("carried_err"))
        return board, self.mod.rows_from_board(board["records"], gating)

    def test_missing_everything_is_unknown_not_an_exception(self):
        board, live = self.live_from_board()
        self.assertEqual(board["records"], {}, "no plan, no cards: no records")
        self.assertFalse(live["state_ok"])
        self.assertTrue(any("state.json not found" in e for e in live["source_errors"]))
        self.assertTrue(any("config.json not found" in e for e in live["source_errors"]))
        self.assertTrue(any("ledger.md not found" in e for e in live["source_errors"]))
        res = self.mod.compute(self.mod.load_spec(), live, NOW)
        self.assertEqual({r["status"] for r in res["rungs"]}, {"unknown"})
        self.assertEqual(len(res["source_errors"]), 3)
        # A corrupt state.json / config.json is an error string too.
        (self.ap / "state.json").write_text("{not json")
        (self.ap / "config.json").write_text("[]")
        _board, live = self.live_from_board()
        self.assertTrue(any("state.json unreadable" in e for e in live["source_errors"]), live["source_errors"])
        self.assertTrue(any("config.json is not an object" in e for e in live["source_errors"]), live["source_errors"])

    def test_real_plan_gives_the_records_and_the_ledger_gives_merge_stamps(self):
        docs = self.root / "docs" / "hermes-port"
        docs.mkdir(parents=True)
        (docs / "dispatch-plan.md").write_text((REPO / "docs" / "hermes-port" / "dispatch-plan.md").read_text(encoding="utf-8"), encoding="utf-8")
        ledger = self.root / "groups" / "orchestrator" / "reports" / "ledger.md"
        ledger.parent.mkdir(parents=True)
        ledger.write_text(
            "# ledger\n\n| row-id | dispatched | spec accepted | PR | verdict | merged/blocked | notes |\n| --- | --- | --- | --- | --- | --- | --- |\n"
            "| LOOP-F35 | 2026-09-09 12:20 IST | 2026-09-09 15:27 IST | #2 | PASS · APPROVE | MERGED `1e3e63f` (squash) — 2026-09-10 21:43Z — 4/4 AC | batch 1a |\n"
            "| MEM-F44 | 2026-09-11 09:00 IST | — | #3 | PASS | MERGED `abc1234` 2026-09-12 15:30 IST | batch 1b |\n"
            "| COST-F30 | 2026-09-13 10:00 IST | — | — | — | blocked: STOP — cap | batch 2 |\n", encoding="utf-8")
        # state.json still says LOOP-F35 is in review (a tick behind the ledger): the record's ledger row wins.
        (self.ap / "state.json").write_text(json.dumps(make_state({"LOOP-F35": "review", "LOOP-F37": "pr_open"}, gating={"1a_first_pass": True},
                                                                  supervise={"LOOP-F37": {"stage": "building"}})))
        (self.ap / "config.json").write_text(json.dumps({"wip": 2, "waive": ["LOOP-F40"], "paused_rows": []}))
        board, live = self.live_from_board()
        recs = board["records"]
        for rid in ROW_META:
            self.assertIn(rid, recs, "every demo-path row is a plan row")
        self.assertEqual(recs["LOOP-F35"]["ledger"]["outcome"], "merged")
        self.assertEqual(recs["LOOP-F35"]["ledger"]["merge_sha"], "1e3e63f")
        self.assertEqual(recs["LOOP-F35"]["ledger"]["merged_at"], "2026-09-10T21:43:00Z")
        self.assertEqual(recs["MEM-F44"]["ledger"]["merged_at"], "2026-09-12T10:00:00Z", "IST stamps convert to UTC")
        self.assertEqual(recs["COST-F30"]["ledger"]["outcome"], "blocked")
        self.assertIsNone(recs["COST-F30"]["ledger"]["merged_at"])
        self.assertEqual(recs["LOOP-F37"]["stage"], "building", "the board's own stage text")
        self.assertEqual((recs["LOOP-F35"]["state"], recs["LOOP-F35"]["stage"]), ("merged", "merged"), "the ledger's merge wins over the stale state.json on the board too")
        self.assertEqual((recs["MEM-F44"]["state"], recs["COST-F30"]["stage"]), ("merged", "blocked"))
        self.assertEqual(recs["LOOP-F40"]["stage"], "queued · waived")
        self.assertEqual(live["order_source"], self.mod.ORDER_SOURCE_QUEUE)
        self.assertEqual(live["rows"]["LOOP-F35"]["state"], "merged")
        self.assertEqual(live["rows"]["LOOP-F37"]["state"], "building")
        self.assertEqual(live["rows"]["COST-F30"]["state"], "blocked")
        self.assertEqual(live["rows"]["COST-F30"]["state_reason"], "STOP — cap")
        self.assertEqual(live["merged_at"], {"LOOP-F35": "2026-09-10T21:43:00Z", "MEM-F44": "2026-09-12T10:00:00Z"},
                         "MEM-F44 is merged in the ledger though still queued in a stale state.json: merged, with its stamp")
        self.assertEqual(live["source_errors"], [])
        res = self.mod.compute(self.mod.load_spec(), live, NOW)
        self.assertEqual(res["wip_limit"], 2)
        self.assertEqual(res["waived"], ["LOOP-F40"])
        r1 = by_id(res["rungs"])["R1"]
        self.assertEqual(by_id(r1["rows"])["LOOP-F35"]["done_at"], "2026-09-10T21:43:00Z")
        self.assertEqual(by_id(r1["rows"])["LOOP-F37"]["state"], "building")
        self.assertEqual(r1["status"], "in_progress")
        self.assertIsNotNone(r1["eta_utc"])
        self.assertTrue(any(b.startswith("COST-F30 blocked in gate batch2_merged") for b in by_id(res["rungs"])["R2"]["blockers"]), by_id(res["rungs"])["R2"]["blockers"])

    def test_cli_prints_and_exits_zero_even_on_a_broken_spec(self):
        docs = self.root / "docs" / "hermes-port"
        docs.mkdir(parents=True)
        (docs / "dispatch-plan.md").write_text((REPO / "docs" / "hermes-port" / "dispatch-plan.md").read_text(encoding="utf-8"), encoding="utf-8")
        (self.ap / "state.json").write_text(json.dumps(make_state({"LOOP-F35": "building"})))
        for flag, needle in (("--slack", "*Demo path*"), ("--html", "<h2>Demo path"), ("--json", '"rungs"')):
            out, err = io.StringIO(), io.StringIO()
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                code = self.mod.main(["--root", str(self.root), flag, "--now", "2026-09-15T10:00:00Z"])
            self.assertEqual(code, 0, err.getvalue())
            self.assertIn(needle, out.getvalue())
        self.assertIn("LOOP-F35 building", out.getvalue() if flag == "--slack" else self.mod.render_slack(json.loads(out.getvalue())))
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
