#!/usr/bin/env python3
"""demo_path.py: the demo-path tracker — five rungs, the matrix rows each one needs, and an ETA per
rung computed with a deterministic model over the rows board's per-row records.

Spec (which rows a rung needs, planning hours, stage factors, manual steps): demo-path.json next to
this file, loaded by load_spec(). Live input is NOT read here: rows-board.py reads every source once
(plan, state.json, config.json, ledger, cards, `ncl sessions list`), builds one record per row and
derives THE row's state on it exactly once (rows-board.row_state → record["state"], state_reason, holds,
waived, paused, gates — the text its index cell and /rows/<ROW>.html show is that state plus decorations).
The tracker consumes those records:

  rows_from_board(records, live_gating)  the ADAPTER: record["state"] + state_reason + holds + waived →
                                          the tracker's row vocabulary; a pure map, it never looks at the
                                          record's raw queue / supervisor / ledger inputs; its docstring is
                                          the mapping
  live_gating(state, config, …)           the few queue-level facts a per-row record does not carry, read
                                          from the already-loaded state.json / config.json objects: gate
                                          flags, WIP limit, config.waive / paused_rows (for display), the
                                          queue's eligible / waiting order, generated_at

so a row's state is derived in exactly one place (the board) and the tracker's chip label is the board's
stage text minus its decorations (`· hold X`, `· cost hold`, `· waived`, a waiting row's gates); the one
label of its own is `waived` for a non-merged row in config.waive (the board shows `<state> · waived`).
Every input is optional: a missing or broken one renders as "unknown" / a banner and the run goes on.

THE ETA MODEL (deterministic; the same text is rendered as the footnote):

  remaining hours of a row = planning_hours[disposition] × stage_factor[state]
      BUILD 48 h · CONFIGURE 15 h · ADOPT 10 h (measured medians / p80)
      queued, waiting 1.0 · dispatched, spec_handoff 0.85 · building 0.6 · pr_open, testing 0.35 · review 0.2 · gate 0.1 · merged 0
  A row is done when merged, or listed in config.waive ("waived": done for the rung, shown as such).
  Open rows are list-scheduled onto wip.limit slots starting now, in the autopilot's own queue order
  (state.json queue.eligible, then queue.waiting — the order the dispatch tick sends them; fallback:
  board order, then the order in demo-path.json): in-flight rows hold their slot for their remaining
  hours; a BUILD row cannot start while another BUILD row runs (the BUILD lane); a row behind a false
  gate starts when the rows that gate requires finish (1a_first_pass, 1a_merged ← batch 1a, batch2_merged
  ← batch 2, batch3_merged ← batch 3, batch4_merged ← batch 4); podman_box is a config flag, so a false
  one makes the rows behind it "unknown" with the reason. The supervisor's holds: a row parked at `gate`
  on a §4.3 merge hold (1a → 1a_merged, batch2 → batch2_merged, batch3+4 → batch3_merged + batch4_merged)
  is the in-flight equivalent of waiting — its remaining 0.1 slice starts no earlier than that gate's rows
  finish ("waits for <gate>"; it is scheduled after the queued rows so those finishes are known, and its
  parked WIP slot is not modelled as busy); a cost hold, a core-change (or any other) hold and an SLO /
  env-fail / blocked-twice escalation are a human-needed stall ("held — <reason>"), excluded from every
  finish time and flagged like blocked. Paused rows (config.paused_rows) and ledger-blocked rows are
  excluded from every finish time and the rungs that need them are flagged ("blocked by pause" /
  "blocked"). A manual item starts when everything in its `after` list (rows, manual items or rungs) has
  finished and lasts `hours` (`hours_max` for the upper end of a range). A row with an `after` list
  starts no earlier than those items finish (its slot is not re-planned). Rung ETA = latest finish over
  its rows, manual items and required rungs; a done rung shows "done <date>" from the ledger's merge
  stamps (else state.json's generated_at).

Public surface (pure functions; the only I/O is load_spec):
  load_spec(path) → dict                          live_gating(state, config, …) → dict
  rows_from_board(records, live_gating) → live    compute(spec, live, now_utc) → dict
  render_html(result) → str fragment (the demo-path page)   render_slack(result) → str (mrkdwn, ≤ 25 lines)
CLI for debugging: python3 demo_path.py --root <ROOT> [--json | --slack | --html] [--now ISO] — loads the
records through rows-board.load_board. Exit 0 always. Stdlib only.
"""

from __future__ import annotations

import argparse
import html
import importlib.util
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC_PATH = os.path.join(HERE, "demo-path.json")
DEFAULT_WIP = 3
SLACK_MAX_LINES = 25
# hermes_queue's vocabulary (kept here as the fallback when the module is unavailable).
IN_FLIGHT_STATES = ("dispatched", "spec_handoff", "building", "pr_open", "testing", "review", "gate")
GATE_BATCH = {"1a_first_pass": "1a", "1a_merged": "1a", "batch2_merged": "2", "batch3_merged": "3", "batch4_merged": "4"}
CONFIG_GATES = ("podman_box",)
# hermes_supervise.merge_hold's §4.3 holds → the gate flag(s) whose rows must finish before the held PR merges.
HOLD_GATES = {"1a": ("1a_merged",), "batch2": ("batch2_merged",), "batch3+4": ("batch3_merged", "batch4_merged")}
STATUS_LABEL = {
    "done": "done", "in_progress": "in progress", "blocked_by_gate": "blocked by gate",
    "not_started": "not started", "unknown": "unknown",
}
STATUS_CLASS = {"done": "ok", "in_progress": "run", "blocked_by_gate": "open", "not_started": "off", "unknown": "bad"}
STATUS_EMOJI = {"done": "✅", "in_progress": "🔨", "blocked_by_gate": "⏳", "not_started": "▫️", "unknown": "❔"}
ROW_CLASS = {
    "merged": "merged", "waived": "merged", "paused": "stalled", "blocked": "stalled", "unknown": "unknown",
    "queued": "queued", "waiting": "queued", "deferred": "stalled", "carried": "queued",
}
HOLD_TEXT = {"cost": "cost card pending", "hold": "hold {label}", "escalated": "escalated ({label})"}
CSS = """
<style>
.dp-row{display:inline-block;font-size:11px;padding:1px 6px;margin:1px 4px 1px 0;border-radius:9px;border:1px solid #ccc;background:#f4f4f4;color:#333;white-space:nowrap}
.dp-row.merged{background:#e3f3e5;border-color:#9fcfa5;color:#1e5b24}.dp-row.inflight{background:#fff3cd;border-color:#f0d58c;color:#664d03}
.dp-row.stalled{background:#fde2e2;border-color:#f5b5b5;color:#7a1c1c}.dp-row.unknown{background:#eee;border-color:#bbb;color:#666;font-style:italic}
.dp-row.queued{background:#f4f4f4}
table.dp td{font-size:13px}table.dp td.rung{white-space:nowrap}table.dp td.eta{white-space:nowrap}
.dp-flag{color:#7a1c1c;font-size:12px}.dp-manual{font-size:12px;color:#444}
</style>
"""


def log(msg: str) -> None:
    sys.stderr.write(f"demo-path: {msg}\n")


# --------------------------------------------------------------------------- time helpers

def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_iso(value) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    v = value.strip()
    if v.endswith(("Z", "z")):
        v = v[:-1] + "+00:00"
    v = re.sub(r"(\.\d{6})\d+", r"\1", v)
    try:
        dt = datetime.fromisoformat(v)
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def fmt_date(dt: datetime | None) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%d") if dt else "unknown"


def fmt_hours(h: float | None) -> str:
    if h is None:
        return "?"
    if h < 48:
        return f"{h:.0f}h"
    return f"{h / 24:.1f}d"


def hours_between(later: datetime, earlier: datetime) -> float:
    return max(0.0, (later - earlier).total_seconds() / 3600.0)


# --------------------------------------------------------------------------- siblings

_ROWS_BOARD = None


def _rows_board():
    """rows-board.py (a hyphenated filename, so importlib), for the CLI only: load_board builds the records."""
    global _ROWS_BOARD
    if _ROWS_BOARD is None:
        path = os.path.join(HERE, "rows-board.py")
        spec = importlib.util.spec_from_file_location("rows_board", path)
        if spec is None or spec.loader is None:
            raise RuntimeError(f"cannot load {path}")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        _ROWS_BOARD = mod
    return _ROWS_BOARD


# --------------------------------------------------------------------------- spec

def _as_item(entry, default_kind: str | None = None) -> dict:
    if isinstance(entry, str):
        return {"id": entry, "kind": default_kind, "after": []}
    if not isinstance(entry, dict) or not entry.get("id"):
        raise ValueError(f"bad item in demo-path.json: {entry!r}")
    out = dict(entry)
    out["id"] = str(out["id"])
    out["kind"] = out.get("kind") or default_kind
    out["after"] = [str(a) for a in (out.get("after") or [])]
    return out


def load_spec(path: str = SPEC_PATH) -> dict:
    """demo-path.json, normalised: every row / manual entry is a dict with id, kind, after; rungs keep
    id, title, rows, manual, requires. Raises ValueError on a structurally unusable file (no rungs)."""
    with open(path, encoding="utf-8") as fh:
        raw = json.load(fh)
    if not isinstance(raw, dict) or not isinstance(raw.get("rungs"), list) or not raw["rungs"]:
        raise ValueError("demo-path.json has no rungs")
    spec = dict(raw)
    spec["planning_hours"] = {str(k).upper(): float(v) for k, v in (raw.get("planning_hours") or {}).items()}
    spec["stage_factors"] = {str(k): float(v) for k, v in (raw.get("stage_factors") or {}).items()}
    rungs = []
    for r in raw["rungs"]:
        if not isinstance(r, dict) or not r.get("id"):
            raise ValueError(f"bad rung in demo-path.json: {r!r}")
        manual = []
        for m in r.get("manual") or []:
            item = _as_item(m, "manual")
            item["kind"] = "manual"
            item["title"] = str(item.get("title") or item["id"])
            try:
                item["hours"] = float(item.get("hours") or 0)
            except (TypeError, ValueError):
                item["hours"] = 0.0
            hm = item.get("hours_max")
            item["hours_max"] = float(hm) if hm not in (None, "") else None
            manual.append(item)
        rungs.append({
            "id": str(r["id"]),
            "title": str(r.get("title") or r["id"]),
            "rows": [_as_item(x) for x in (r.get("rows") or [])],
            "manual": manual,
            "requires": [str(x) for x in (r.get("requires") or [])],
        })
    spec["rungs"] = rungs
    notes = raw.get("notes")
    spec["notes"] = " ".join(str(n) for n in notes) if isinstance(notes, list) else str(notes or "")
    return spec


# --------------------------------------------------------------------------- live inputs: the board's records + the queue's gating

ORDER_SOURCE_QUEUE = "state.json queue (eligible, then waiting)"
ORDER_SOURCE_BOARD = "board order (state.json has no queue block; gate waits unknown)"
ORDER_SOURCE_SPEC = "demo-path.json"


def live_gating(state, config, state_err: str | None = None, config_err: str | None = None, ledger_err: str | None = None) -> dict:
    """The queue-level facts the per-row board records do NOT carry, taken once from the autopilot's
    state.json + config.json objects that rows-board.load_board already read (no I/O here; a missing
    file arrives as None, a broken one as None + its *_err string):

      gating        state.gating — the gate flags (1a_first_pass, 1a_merged, batch2_merged, batch3_merged, batch4_merged, podman_box)
      wip_limit     config.wip, else state.wip.limit, else 3
      waive         config.waive (else state.gating.waived) — for the result's `waived` list only; whether a
      paused_rows   config.paused_rows                       — ROW is waived / paused is the record's own field
      eligible      state.queue.eligible — queued rows dispatchable now, in the autopilot's dispatch order
      waiting       state.queue.waiting → [(row, unmet gates)] — queued rows behind a gate, same order
      queue_ok      whether state.json carried a queue block at all
      state_ok, generated_at, errors (banner lines: state.json / config.json missing or unreadable, the ledger)
    """
    st = state if isinstance(state, dict) else None
    cfg = config if isinstance(config, dict) else {}
    gating = st.get("gating") if st is not None and isinstance(st.get("gating"), dict) else {}
    errors = []
    if state_err:
        errors.append(state_err)
    elif st is None:
        errors.append("state.json not found (the first autopilot tick writes it)")
    if config_err:
        errors.append(config_err)
    elif not isinstance(config, dict):
        errors.append("config.json not found; defaults (wip 3, nothing waived or paused)")
    if ledger_err:
        errors.append(f"{ledger_err}; done dates fall back to state.json")
    try:
        wip = cfg.get("wip") if cfg.get("wip") is not None else ((st or {}).get("wip") or {}).get("limit")
        wip_limit = max(1, int(wip if wip is not None else DEFAULT_WIP))
    except (TypeError, ValueError):
        wip_limit = DEFAULT_WIP
    queue = st.get("queue") if st is not None and isinstance(st.get("queue"), dict) else None
    eligible = [str(x) for x in (queue.get("eligible") or []) if x] if queue else []
    waiting = []
    for w in (queue.get("waiting") or []) if queue else []:
        if isinstance(w, dict) and w.get("id"):
            waiting.append((str(w["id"]), tuple(str(g) for g in (w.get("blocked_by") or []))))
        elif isinstance(w, str):
            waiting.append((w, ()))
    return {
        "state_ok": st is not None,
        "generated_at": st.get("generated_at") if st is not None else None,
        "gating": gating,
        "wip_limit": wip_limit,
        "waive": sorted({str(x) for x in (cfg.get("waive") or gating.get("waived") or [])}),
        "paused_rows": sorted({str(x) for x in (cfg.get("paused_rows") or [])}),
        "eligible": eligible,
        "waiting": waiting,
        "queue_ok": queue is not None,
        "errors": errors,
    }


def _hold_text(h: dict) -> str:
    return HOLD_TEXT.get(str(h.get("kind")), "{label}").format(label=h.get("label") or "?")


def _board_row(rec: dict) -> dict:
    """One record → one tracker row: a pure map over the record's canonical fields (rows-board.row_state:
    state, state_reason, holds, waived, paused) plus its disposition / batch — see rows_from_board."""
    holds = [h for h in (rec.get("holds") or []) if isinstance(h, dict)]
    state = str(rec.get("state") or "") or None
    stalls = [h for h in holds if h.get("kind") != "gate"]
    return {
        "state": state or "unknown",
        "state_reason": rec.get("state_reason") or (None if state else "unknown"),
        "disposition": (str(rec.get("disposition") or "").upper() or None),
        "batch": rec.get("batch"),
        "paused": bool(rec.get("paused")),
        "waived": bool(rec.get("waived")),
        "follow_up": bool(rec.get("follow_up")),  # a `<PARENT>.<letter>` row: never a WIP slot, never in the schedule
        "held": "; ".join(_hold_text(h) for h in stalls) or None,
        "hold_gates": tuple(g for h in holds if h.get("kind") == "gate" for g in HOLD_GATES.get(str(h.get("label")), ())),
    }


def rows_from_board(records: dict, gating: dict) -> dict:
    """THE ADAPTER: rows-board's per-row records (rows-board.build_records — the objects it renders
    /rows/<ROW>.html from) → the live input compute() consumes. A row's state is derived ONCE on the board
    (rows-board.row_state: ledger merged > paused > blocked > deferred > in flight > waiting > queued) and
    only MAPPED here — this function reads record["state"], state_reason, holds, waived, paused, disposition,
    batch and merged_at, never the record's raw queue / supervisor / ledger inputs:

      record                                        → tracker row
      state None (no state.json / not in it)        → state unknown, reason = record.state_reason
      state merged                                  → merged                 (done)
      waived (config.waive), not merged             → label waived           (done; the board shows `<state> · waived`)
      state paused                                  → paused                 (stalled: excluded from ETAs, rung flagged)
      state blocked                                 → blocked + state_reason (stalled: a rung blocker)
      state deferred                                → deferred               (stalled)
      holds with kind cost | hold | escalated       → held — <reason>        (stalled: a human must act; label = state)
      holds with kind gate (1a | batch2 | batch3+4) → hold_gates (1a_merged | batch2_merged | batch3_merged +
                                                      batch4_merged): in flight, scheduled after that gate's rows finish
      any other state (in flight, waiting, queued …) → as is; waiting is scheduled like queued behind its gates

    Schedule order: rows already placed (merged / in flight / stalled) in board order, then gating.eligible,
    then gating.waiting with their unmet gates — the order the dispatch tick sends rows; a queued row the
    queue block does not list is appended with no gates; rows on a gate hold come last (their gate's rows
    must be scheduled first). Without a queue block: board order, no gates (noted in source_errors).
    merged_at: each record's ledger merge stamp, merged rows only.

    Follow-up rows (record `follow_up`, hermes_queue `follow_up_rows`) are mapped but never scheduled: no WIP slot in
    the queue, none here.

    Returns {"rows": {rid: {"state", "state_reason", "disposition", "batch", "paused", "waived", "follow_up", "held", "hold_gates"}},
             "state_ok", "generated_at", "gating", "wip_limit", "waive", "paused_rows",
             "order": [(rid, gates)], "order_source", "merged_at": {rid: ISO}, "source_errors": [str]}."""
    rows = {str(rid): _board_row(rec) for rid, rec in (records or {}).items() if isinstance(rec, dict)}
    errors = list(gating.get("errors") or [])
    # a follow-up row (`<PARENT>.<letter>`, hermes_queue `follow_up_rows`) holds no WIP slot in the queue and takes
    # none here: it is never placed, so it never delays a plan row's start (the board shows it in its own section)
    known = [rid for rid, r in rows.items() if r["state"] != "unknown" and not r["follow_up"]]
    held_last = [rid for rid in known if rows[rid]["hold_gates"]]
    if gating.get("queue_ok"):
        placed = [rid for rid in known if rows[rid]["state"] not in ("queued", "waiting") and rid not in held_last]
        listed = set(placed) | set(held_last)
        order = [(rid, ()) for rid in placed]
        for rid in gating.get("eligible") or []:
            if rid in rows and rid not in listed:
                order.append((rid, ()))
                listed.add(rid)
        for rid, gates in gating.get("waiting") or []:
            if rid in rows and rid not in listed:
                order.append((rid, tuple(gates)))
                listed.add(rid)
        order += [(rid, ()) for rid in known if rid not in listed]
        order_source = ORDER_SOURCE_QUEUE
    else:
        order = [(rid, ()) for rid in known if rid not in held_last]
        order_source = ORDER_SOURCE_BOARD
        if gating.get("state_ok"):
            errors.append("state.json has no queue block; rows scheduled in board order without gate waits")
    order += [(rid, rows[rid]["hold_gates"]) for rid in held_last]
    merged_at = {}
    for rid, rec in (records or {}).items():
        if isinstance(rec, dict) and rec.get("merged_at") and rows.get(str(rid), {}).get("state") == "merged":
            merged_at[str(rid)] = str(rec["merged_at"])
    return {
        "rows": rows,
        "state_ok": bool(gating.get("state_ok")),
        "generated_at": gating.get("generated_at"),
        "gating": gating.get("gating") if isinstance(gating.get("gating"), dict) else {},
        "wip_limit": gating.get("wip_limit") or DEFAULT_WIP,
        "waive": list(gating.get("waive") or []),
        "paused_rows": list(gating.get("paused_rows") or []),
        "order": order,
        "order_source": order_source,
        "merged_at": merged_at,
        "source_errors": errors,
    }


# --------------------------------------------------------------------------- compute

def _row_info(rid: str, spec_kind: str | None, live: dict, spec: dict) -> dict:
    """One row's facts for the model, from the adapter's row (rows_from_board): effective state,
    disposition, batch, remaining hours, done / stalled / in_flight / hold_gates."""
    rows = live.get("rows") if isinstance(live.get("rows"), dict) else {}
    row = rows.get(rid) if isinstance(rows.get(rid), dict) else None
    factors = spec["stage_factors"]
    info: dict = {"id": rid, "state": "unknown", "disposition": None, "batch": None, "remaining": None,
                  "done": False, "stalled": None, "in_flight": False, "hold_gates": (), "label": "unknown", "reason": None}
    if not live.get("state_ok"):
        info["reason"] = "state.json unavailable"
        return info
    if row is None:
        info["reason"] = "not on the rows board (not a plan row)"
        return info
    st = str(row.get("state") or "queued")
    if st == "unknown":
        info["reason"] = row.get("state_reason") or "unknown"
        return info
    disp = str(row.get("disposition") or spec_kind or "").upper() or None
    info.update({"state": st, "disposition": disp, "batch": row.get("batch")})
    if st == "merged":
        info.update({"done": True, "remaining": 0.0, "label": "merged"})
    elif row.get("waived"):
        info.update({"done": True, "remaining": 0.0, "label": "waived", "state": "waived"})
    elif st == "paused":
        info.update({"stalled": "paused", "label": "paused"})
    elif st == "blocked":
        info.update({"stalled": "blocked", "label": "blocked", "reason": row.get("state_reason")})
    elif st == "deferred":
        info.update({"stalled": "deferred", "label": "deferred"})
    elif row.get("held"):
        info.update({"stalled": "held", "label": st, "reason": row["held"]})
    else:
        base = spec["planning_hours"].get(disp or "")
        factor = factors.get("queued" if st == "waiting" else st, 1.0)  # waiting = queued behind a gate: same hours
        info["remaining"] = None if base is None else round(base * factor, 2)
        info["in_flight"] = st in IN_FLIGHT_STATES
        info["hold_gates"] = tuple(row.get("hold_gates") or ()) if info["in_flight"] else ()
        info["label"] = st
        if base is None:
            info["reason"] = f"no planning hours for disposition {disp or '?'}"
    return info


def _simulate(order: list, infos: dict, wip_limit: int, gating: dict, now: datetime) -> tuple:
    """List-schedule every open row in `order` onto wip_limit slots. Returns ({rid: start}, {rid: finish},
    {rid: [blocker strings]}); a row with no finish is unknown (behind podman_box, behind a stalled row…)."""
    start: dict = {}
    finish: dict = {}
    blockers: dict = {rid: [] for rid, _ in order}
    gate_stalled: dict = {rid: [] for rid, _ in order}  # [(stalled row, kind, gate)] per waiting row
    by_batch: dict = {}
    for rid, _ in order:
        b = infos[rid].get("batch")
        if b:
            by_batch.setdefault(str(b), []).append(rid)

    def hours(h) -> timedelta:
        return timedelta(hours=float(h or 0))

    busy: list = []
    lane = {"free": now}  # the BUILD lane: when the next BUILD row may start
    for rid, _ in order:
        info = infos[rid]
        if info["done"]:
            finish[rid] = now  # already merged: the floor for any gate that depends on it
        elif info["stalled"] or info["hold_gates"]:
            continue  # stalled: no finish time (a blocker below); held at gate: placed once its gate's rows have one
        elif info["in_flight"] and info["remaining"] is not None:
            start[rid] = now
            finish[rid] = now + hours(info["remaining"])
            busy.append(finish[rid])
            if info["disposition"] == "BUILD":
                lane["free"] = max(lane["free"], finish[rid])

    def gate_ready(gate: str) -> tuple:
        """(datetime | None, reason | None): when the gate's rows are all finished; None = unknowable."""
        if gating.get(gate):
            return now, None
        if gate in CONFIG_GATES:
            return None, f"config.{gate} is false"
        batch = GATE_BATCH.get(gate)
        if batch is None:
            return None, f"unknown gate {gate}"
        t = now
        for r in by_batch.get(batch, []):
            if infos[r]["done"] or infos[r]["stalled"]:
                continue
            f = finish.get(r)
            if f is None:
                return None, f"{r} has no finish time"
            t = max(t, f)
        return t, None

    def gates_open(rid: str, gates: tuple, note: bool) -> tuple:
        """(ready datetime | None, unknowable reason | None) over a row's gates; with `note`, records the row's
        "waits for …" blocker and the stalled rows inside those gates."""
        ready = now
        waits = []
        for g in gates:
            t, why = gate_ready(g)
            if t is None:
                return None, f"gate {g}: {why}"
            if t > now:
                waits.append(g)
            ready = max(ready, t)
        if note:
            if waits:
                blockers[rid].append("waits for " + ", ".join(waits))
            for g in gates:
                if gating.get(g):
                    continue
                for r in by_batch.get(GATE_BATCH.get(g, ""), []):
                    if infos[r]["stalled"]:
                        gate_stalled[rid].append((r, infos[r]["stalled"], g))
                        blockers[rid].append(f"{r} {infos[r]['stalled']} in gate {g}")
        return ready, None

    def place_held(rid: str, gates: tuple) -> str | None:
        """A row parked at `gate` on a merge hold keeps its WIP slot and the BUILD lane until the batch it holds for
        has merged, then needs its last slice: start = that batch's finish, no new slot taken. Returns the unknowable
        reason when the gate's rows have no finish time yet (called again after the queued rows are placed)."""
        info = infos[rid]
        ready, unknowable = gates_open(rid, gates, note=False)
        if ready is None:
            return unknowable
        gates_open(rid, gates, note=True)
        s = max(now, ready)
        f = s + hours(info["remaining"])
        start[rid], finish[rid] = s, f
        busy.append(f)  # its slot stays taken until then (only counts when placed before the slots are laid out)
        if info["disposition"] == "BUILD":
            lane["free"] = max(lane["free"], f)
        return None

    held = [(rid, g) for rid, g in order if infos[rid]["hold_gates"] and not infos[rid]["stalled"] and not infos[rid]["done"]
            and infos[rid]["remaining"] is not None]
    for rid, g in held:
        place_held(rid, g)  # placed now when the gate's rows are merged / in flight; otherwise retried in order below
    busy.sort()
    if len(busy) > wip_limit:  # more in flight than the limit: new rows start only once running < limit
        busy = busy[len(busy) - wip_limit:]
    slots = busy + [now] * (wip_limit - len(busy))

    for rid, gates in order:
        info = infos[rid]
        if rid in finish:
            continue
        if info["stalled"]:
            blockers[rid].append(info["stalled"] + (f" — {info['reason']}" if info.get("reason") else ""))
            continue
        if info["remaining"] is None:
            blockers[rid].append(info.get("reason") or "no remaining-hours estimate")
            continue
        if info["hold_gates"]:
            unknowable = place_held(rid, gates)
            if unknowable:
                blockers[rid].append(unknowable)
            continue
        ready, unknowable = gates_open(rid, gates, note=True)
        if ready is None:
            blockers[rid].append(unknowable)
            continue
        i = min(range(len(slots)), key=lambda k: slots[k])
        s = max(slots[i], ready)
        if info["disposition"] == "BUILD":
            s = max(s, lane["free"])
        f = s + hours(info["remaining"])
        slots[i] = f
        if info["disposition"] == "BUILD":
            lane["free"] = f
        start[rid], finish[rid] = s, f
    return start, finish, blockers, gate_stalled


def compute(spec: dict, live: dict, now_utc: datetime) -> dict:
    """The tracker over the adapter's live input (rows_from_board): {generated_at, state_ok, wip_limit,
    order_source, waived, paused_rows, source_errors, rungs: [...], model_notes}. Pure; never raises on
    missing live pieces (they become "unknown"), only on a structurally broken spec."""
    now = now_utc.astimezone(timezone.utc) if now_utc.tzinfo else now_utc.replace(tzinfo=timezone.utc)
    state_ok = bool(live.get("state_ok"))
    live_rows = live.get("rows") if isinstance(live.get("rows"), dict) else {}
    gating = live.get("gating") if isinstance(live.get("gating"), dict) else {}
    waive = {str(x) for x in (live.get("waive") or [])}
    paused = {str(x) for x in (live.get("paused_rows") or [])}
    try:
        wip_limit = max(1, int(live.get("wip_limit") or DEFAULT_WIP))
    except (TypeError, ValueError):
        wip_limit = DEFAULT_WIP
    generated_at = parse_iso(live.get("generated_at"))
    merged_at = live.get("merged_at") if isinstance(live.get("merged_at"), dict) else {}
    # waive / paused are the records' own fields (the board's one derivation); these two lists are for display only.

    spec_kind: dict = {}
    row_after: dict = {}
    spec_row_ids: list = []
    for rung in spec["rungs"]:
        for r in rung["rows"]:
            spec_kind.setdefault(r["id"], r.get("kind"))
            if r.get("after") and r["id"] not in row_after:
                row_after[r["id"]] = list(r["after"])
            if r["id"] not in spec_row_ids:
                spec_row_ids.append(r["id"])

    order = live.get("order") if isinstance(live.get("order"), list) and live.get("order") else None
    order_source = str(live.get("order_source") or ORDER_SOURCE_SPEC) if order else ORDER_SOURCE_SPEC
    if not order:
        order = [(rid, ()) for rid in spec_row_ids]
    # Every row the board knows with a state competes for slots; unknown rows cannot be scheduled.
    sim_order = ([(rid, tuple(g)) for rid, g in order if rid in live_rows and live_rows[rid].get("state") != "unknown"]
                 if state_ok else [])
    infos = {rid: _row_info(rid, spec_kind.get(rid), live, spec) for rid, _ in sim_order}
    for rid in spec_row_ids:
        if rid not in infos:
            infos[rid] = _row_info(rid, spec_kind.get(rid), live, spec)
    start, finish, sim_blockers, gate_stalled = _simulate(sim_order, infos, wip_limit, gating, now) if sim_order else ({}, {}, {}, {})

    rung_by_id = {r["id"]: r for r in spec["rungs"]}
    manual_by_id = {m["id"]: (m, r["id"]) for r in spec["rungs"] for m in r["manual"]}
    memo: dict = {}

    def done_dt(rid: str) -> datetime:
        return parse_iso(merged_at.get(rid)) or generated_at or now

    def finish_of(ref: str, stack: tuple) -> tuple:
        """(finish, finish_max) for a row id, a manual id or a rung id; (None, None) when unknowable."""
        if ref in memo:
            return memo[ref]
        if ref in stack:
            log(f"cycle in demo-path.json at {ref}")
            return None, None
        stack = stack + (ref,)
        if ref in rung_by_id:
            val = rung_finish(rung_by_id[ref], stack)
        elif ref in manual_by_id:
            val = manual_finish(manual_by_id[ref][0], stack)
        else:
            val = row_finish(ref, stack)
        memo[ref] = val
        return val

    def row_finish(rid: str, stack: tuple) -> tuple:
        info = infos.get(rid)
        if info is None or info["state"] == "unknown":
            return None, None
        if info["done"]:
            d = done_dt(rid)
            return d, d
        if info["stalled"]:
            return None, None
        f = finish.get(rid)
        if f is None:
            return None, None
        f2 = f
        if row_after.get(rid):
            deps = [finish_of(d, stack) for d in row_after[rid]]
            if any(d[0] is None for d in deps):
                return None, None
            dep, dep2 = max(d[0] for d in deps), max(d[1] for d in deps)
            s = start.get(rid, now)
            if dep > s:
                f = f + (dep - s)
            f2 = f + max(timedelta(0), dep2 - dep)
        return f, f2

    def manual_finish(m: dict, stack: tuple) -> tuple:
        if m.get("done_at"):
            d = parse_iso(m["done_at"]) or now
            return d, d
        s = s2 = now
        for d in m.get("after") or []:
            f, f2 = finish_of(d, stack)
            if f is None:
                return None, None
            s, s2 = max(s, f), max(s2, f2)
        return s + timedelta(hours=m["hours"]), s2 + timedelta(hours=m["hours_max"] if m.get("hours_max") else m["hours"])

    def rung_finish(rung: dict, stack: tuple) -> tuple:
        best = best2 = None
        # Paused rows are excluded from the ETA (the rung is flagged "blocked by pause" instead).
        refs = [r["id"] for r in rung["rows"] if infos.get(r["id"], {}).get("stalled") != "paused"]
        refs += [m["id"] for m in rung["manual"]] + list(rung["requires"])
        if not refs:
            return None, None
        for ref in refs:
            f, f2 = finish_of(ref, stack)
            if f is None:
                return None, None
            best = f if best is None else max(best, f)
            best2 = f2 if best2 is None else max(best2, f2)
        return best, best2

    def rung_done(rung: dict, stack: tuple = ()) -> bool:
        if rung["id"] in stack:
            return False
        stack = stack + (rung["id"],)
        return (all(infos.get(r["id"], {}).get("done") for r in rung["rows"])
                and all(bool(m.get("done_at")) for m in rung["manual"])
                and all(rung_done(rung_by_id[q], stack) for q in rung["requires"] if q in rung_by_id))

    rungs_out = []
    for rung in spec["rungs"]:
        rows_out = []
        flags: list = []
        blockers: list = []
        unknown_by_reason: dict = {}
        for r in rung["rows"]:
            rid = r["id"]
            info = infos[rid]
            f, _f2 = finish_of(rid, ())
            row_blockers = list(sim_blockers.get(rid) or [])
            if info["stalled"] and not row_blockers:
                row_blockers.append(info["stalled"] + (f" — {info['reason']}" if info.get("reason") else ""))
            if info["state"] == "unknown":
                row_blockers.append(info.get("reason") or "unknown")
            eta = None if info["done"] else f
            rows_out.append({
                "id": rid, "kind": info["disposition"] or r.get("kind"), "state": info["state"], "label": info["label"],
                "batch": info.get("batch"), "done": info["done"], "in_flight": info["in_flight"], "stalled": info["stalled"],
                "remaining_hours": info["remaining"], "start_utc": iso(start[rid]) if rid in start else None,
                "eta": iso(eta) if eta else None, "done_at": iso(done_dt(rid)) if info["done"] else None,
                "blockers": row_blockers, "after": list(r.get("after") or []),
            })
            if info["stalled"] == "paused":
                flags.append(f"blocked by pause: {rid}")
            elif info["stalled"]:
                blockers.append(f"{rid} {info['stalled']}" + (f" — {info['reason']}" if info.get("reason") else ""))
            elif info["state"] == "unknown":
                unknown_by_reason.setdefault(info.get("reason") or "unknown", []).append(rid)
            elif not info["done"] and f is None:
                blockers.extend(f"{rid}: {b}" for b in row_blockers if not b.startswith("waits for"))
        for reason, ids in unknown_by_reason.items():
            blockers.append(f"{reason}: {', '.join(ids)}")
        seen_gate_stall: set = set()
        for r in rung["rows"]:
            for srow, kind, gate in gate_stalled.get(r["id"]) or []:
                if (srow, gate) in seen_gate_stall:
                    continue
                seen_gate_stall.add((srow, gate))
                line = f"{srow} {kind} in gate {gate}" + (" (config.paused_rows)" if kind == "paused" else "")
                (flags if kind == "paused" else blockers).append(("blocked by pause: " if kind == "paused" else "") + line)
        manual_out = []
        for m in rung["manual"]:
            f, f2 = finish_of(m["id"], ())
            deps_unknown = [d for d in m.get("after") or [] if finish_of(d, ())[0] is None]
            manual_out.append({
                "id": m["id"], "title": m["title"], "hours": m["hours"], "hours_max": m.get("hours_max"),
                "after": list(m.get("after") or []), "done": bool(m.get("done_at")), "done_at": m.get("done_at"),
                "eta": iso(f) if f and not m.get("done_at") else None, "eta_max": iso(f2) if f2 and f2 != f and not m.get("done_at") else None,
            })
            if deps_unknown and not m.get("done_at"):
                blockers.append(f"{m['id']} waits for {', '.join(deps_unknown)} (unknown)")
        for q in rung["requires"]:
            if q not in rung_by_id:
                blockers.append(f"requires unknown rung {q}")
            elif not rung_done(rung_by_id[q]) and finish_of(q, ())[0] is None:
                blockers.append(f"requires {q} (ETA unknown)")

        f, f2 = finish_of(rung["id"], ())
        done = rung_done(rung)
        if not state_ok:
            status = "unknown"
        elif done:
            status = "done"
        else:
            # a held row (a cost card, a core-change hold, an escalation) is in flight for the rung's status even though it is stalled for the ETA
            started = (any(x["done"] or x["in_flight"] or x["state"] in IN_FLIGHT_STATES for x in rows_out)
                       or any(x["done"] for x in manual_out))
            open_rows = [x for x in rows_out if not x["done"] and not x["stalled"] and x["state"] != "unknown"]
            gated = [x for x in open_rows if any(b.startswith(("waits for", "gate ")) for b in x["blockers"])]
            eligible_now = [x for x in open_rows if x not in gated]
            reqs_open = [q for q in rung["requires"] if q in rung_by_id and not rung_done(rung_by_id[q])]
            if started:
                status = "in_progress"
            elif eligible_now:
                status = "not_started"  # something the queue could dispatch right now
            elif gated or reqs_open or any(not x["done"] and x["after"] for x in manual_out):
                status = "blocked_by_gate"
            else:
                status = "not_started"
        gate_names = sorted({g for x in rows_out for b in x["blockers"] if b.startswith("waits for ") for g in b[len("waits for "):].split(", ")})
        if status == "done":
            eta, eta_max, hours_left = f, None, 0.0
        else:
            eta = f
            eta_max = f2 if f2 and f and f2 != f else None
            hours_left = round(hours_between(f, now), 1) if f else None
        rungs_out.append({
            "id": rung["id"], "title": rung["title"], "status": status, "status_label": STATUS_LABEL[status],
            "eta_utc": iso(eta) if eta else None, "eta_max_utc": iso(eta_max) if eta_max else None,
            "eta_date": fmt_date(eta) if eta else None, "hours_remaining": hours_left,
            "done_at": iso(f) if status == "done" and f else None,
            "rows": rows_out, "manual": manual_out, "requires": list(rung["requires"]),
            "gates": gate_names, "blockers": blockers, "flags": flags,
        })

    source_errs = [str(e) for e in (live.get("source_errors") or []) if e]
    return {
        "generated_at": iso(now),
        "state_generated_at": live.get("generated_at"),
        "state_ok": state_ok,
        "wip_limit": wip_limit,
        "order_source": order_source,
        "waived": sorted(waive),
        "paused_rows": sorted(paused),
        "source_errors": source_errs,
        "rungs": rungs_out,
        "model_notes": model_notes(spec, wip_limit, order_source),
    }


def model_notes(spec: dict, wip_limit: int, order_source: str) -> str:
    ph = spec.get("planning_hours") or {}
    sf = spec.get("stage_factors") or {}
    hours = " · ".join(f"{k} {v:g}h" for k, v in ph.items())
    factors = " · ".join(f"{k} {v:g}" for k, v in sf.items())
    return (f"remaining = planning hours ({hours}) × stage factor ({factors}); open rows list-scheduled in {order_source} "
            f"onto {wip_limit} WIP slots from now, one BUILD in flight at a time, gated rows start when their gate's rows finish "
            f"(a row parked at gate on a merge hold likewise, after the rows of the batch it holds for); "
            f"paused / blocked / held (cost card, core-change hold, escalation) rows excluded and flagged; "
            f"manual items start when their prerequisites finish. "
            + (spec.get("notes") or ""))


# --------------------------------------------------------------------------- renderers

def _esc(s) -> str:
    return html.escape(str(s if s is not None else ""), quote=True)


def _row_class(row: dict) -> str:
    if row.get("done"):
        return "merged"
    if row.get("stalled"):
        return "stalled"
    if row.get("in_flight"):
        return "inflight"
    return ROW_CLASS.get(str(row.get("state")), "queued")


def _row_tip(row: dict) -> str:
    bits = [f"{row['id']} · {row.get('kind') or '?'} · {row['label']}"]
    if row.get("remaining_hours") is not None and not row.get("done"):
        bits.append(f"remaining ≈ {row['remaining_hours']:g}h")
    if row.get("eta"):
        bits.append(f"finish {row['eta']}")
    if row.get("done_at"):
        bits.append(f"merged {row['done_at'][:10]}")
    bits.extend(row.get("blockers") or [])
    return " · ".join(bits)


def render_html(result: dict) -> str:
    """The rows board's "Demo path" section: one table row per rung + the model as a <details> footnote."""
    head = (f'<h2>Demo path <small>{len(result.get("rungs") or [])} rungs · WIP {_esc(result.get("wip_limit"))} · '
            f'state {_esc(result.get("state_generated_at") or "unknown")}</small></h2>')
    out = [CSS, head]
    out.append('<p class="muted">Five rungs to the demo; each needs specific matrix rows. Row states are the rows board\'s own '
               '(the same records behind each <code>&lt;ROW&gt;.html</code>); status and ETA come from them through a deterministic '
               'model (footnote below). Dates are UTC.</p>')
    for err in result.get("source_errors") or []:
        out.append(f'<div class="banner">{_esc(err)}</div>')
    out.append('<table class="tbl dp"><tr><th>rung</th><th>status</th><th>ETA (UTC)</th><th>required rows</th><th>manual steps · blockers</th></tr>')
    for rung in result.get("rungs") or []:
        status = rung["status"]
        if status == "done":
            eta_cell = f'<span class="st ok">done {_esc(fmt_date(parse_iso(rung.get("done_at"))))}</span>'
        elif rung.get("eta_utc"):
            eta_cell = f'<b>{_esc(rung["eta_date"])}</b><br><small>≈ {_esc(fmt_hours(rung.get("hours_remaining")))} left</small>'
            if rung.get("eta_max_utc"):
                eta_cell += f'<br><small>to {_esc(fmt_date(parse_iso(rung["eta_max_utc"])))}</small>'
        else:
            eta_cell = '<span class="st bad">unknown</span>'
        chips = "".join(f'<span class="dp-row {_row_class(r)}" title="{_esc(_row_tip(r))}">{_esc(r["id"])} · {_esc(r["label"])}</span>'
                        for r in rung["rows"]) or '<span class="muted">no matrix rows</span>'
        if rung.get("requires"):
            chips += f'<br><small class="muted">requires {_esc(", ".join(rung["requires"]))}</small>'
        extra = []
        for m in rung["manual"]:
            when = "done" if m["done"] else (f'ETA {fmt_date(parse_iso(m["eta"]))}' if m.get("eta") else "ETA unknown")
            hrs = f'{m["hours"]:g}h' + (f'–{m["hours_max"]:g}h' if m.get("hours_max") else "")
            extra.append(f'<div class="dp-manual">manual · {_esc(m["title"])} <small>({_esc(hrs)}) · {_esc(when)}</small></div>')
        for fl in rung.get("flags") or []:
            extra.append(f'<div class="dp-flag">⚠ {_esc(fl)}</div>')
        for b in rung.get("blockers") or []:
            extra.append(f'<div class="dp-flag">{_esc(b)}</div>')
        if rung.get("gates"):
            extra.append(f'<div class="muted"><small>gates: {_esc(", ".join(rung["gates"]))}</small></div>')
        out.append(f'<tr><td class="rung"><b>{_esc(rung["id"])}</b><br><small>{_esc(rung["title"])}</small></td>'
                   f'<td><span class="st {STATUS_CLASS[status]}">{_esc(rung["status_label"])}</span></td>'
                   f'<td class="eta">{eta_cell}</td><td>{chips}</td><td>{"".join(extra) or "·"}</td></tr>')
    out.append("</table>")
    out.append(f'<details><summary class="muted">ETA model</summary><p class="muted"><small>{_esc(result.get("model_notes"))}</small></p></details>')
    return "".join(out)


def render_slack(result: dict) -> str:
    """The one #hermes-port message (edited in place): mrkdwn, ≤ 25 lines, *bold*, • bullets, no tables / headings.
    Caller escapes `& < >` (SlackClient does); this text carries none of its own."""
    head = (f"*Demo path* · updated {result.get('generated_at', '')[:16].replace('T', ' ')}Z · WIP {result.get('wip_limit')} · "
            f"state {(result.get('state_generated_at') or 'unknown')[:16].replace('T', ' ')}")
    lines = [head]
    for err in (result.get("source_errors") or [])[:2]:
        lines.append(f"_{_squash(err, 140)}_")
    for rung in result.get("rungs") or []:
        status = rung["status"]
        if status == "done":
            when = f"done {fmt_date(parse_iso(rung.get('done_at')))}"
        elif rung.get("eta_utc"):
            when = f"ETA {rung['eta_date']} (≈{fmt_hours(rung.get('hours_remaining'))} left)"
            if rung.get("eta_max_utc"):
                when += f" to {fmt_date(parse_iso(rung['eta_max_utc']))}"
        else:
            when = "ETA unknown"
        lines.append(f"{STATUS_EMOJI[status]} *{rung['id']}* {rung['title']} — *{rung['status_label']}* · {when}")
        parts = [f"{r['id']} {r['label']}" for r in rung["rows"]]
        parts += [f"manual {m['id']} {'done' if m['done'] else fmt_hours(m['hours'])}" for m in rung["manual"]]
        if rung.get("requires"):
            parts.append("requires " + "+".join(rung["requires"]))
        lines.append("    • " + _squash(" · ".join(parts), 300))
        notes = list(rung.get("flags") or []) + list(rung.get("blockers") or [])
        if rung.get("gates"):
            notes.append("waits for " + ", ".join(rung["gates"]))
        if notes:
            lines.append("    • " + _squash("; ".join(notes), 300))
    footer = ("_model: planning hours × stage factor, list-scheduled on WIP slots in autopilot order, one BUILD at a time; "
              "paused/blocked/held rows excluded and flagged; details on the rows board_")
    lines = lines[: SLACK_MAX_LINES - 1]
    lines.append(footer)
    return "\n".join(lines)


def _squash(s, n: int) -> str:
    s = re.sub(r"\s+", " ", str(s if s is not None else "")).strip()
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


# --------------------------------------------------------------------------- cli

def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Demo path tracker: rung status + ETA over the rows board's per-row records (rows-board.load_board).")
    ap.add_argument("--root", default=os.environ.get("NANOCLAW_ROOT") or os.getcwd(), help="nanoclaw checkout (data/, docs/, groups/)")
    ap.add_argument("--spec", default=os.environ.get("DEMO_PATH_SPEC") or SPEC_PATH, help="demo-path.json (default: next to this script)")
    ap.add_argument("--state", default=None, help="state.json override")
    ap.add_argument("--config", default=None, help="config.json override")
    ap.add_argument("--ledger", default=None, help="ledger.md override")
    ap.add_argument("--ncl", default=None, help="ncl binary for the board's live dots (default: none; the tracker does not need them)")
    ap.add_argument("--now", default=None, help="ISO timestamp (tests)")
    fmt = ap.add_mutually_exclusive_group()
    fmt.add_argument("--json", action="store_true", help="print compute() as JSON (default)")
    fmt.add_argument("--slack", action="store_true", help="print the Slack mrkdwn text")
    fmt.add_argument("--html", action="store_true", help="print the demo-path HTML fragment")
    try:
        args = ap.parse_args(argv)
        now = parse_iso(args.now) or datetime.now(timezone.utc)
        spec = load_spec(args.spec)
        board = _rows_board().load_board(os.path.abspath(args.root), now, state_path=args.state, config_path=args.config,
                                         ledger_path=args.ledger, ncl_bin=args.ncl or None)
        gating = live_gating(board["state"], board["config"], state_err=board["state_err"], config_err=board["config_err"],
                             ledger_err=(board.get("tables") or {}).get("carried_err"))
        result = compute(spec, rows_from_board(board["records"], gating), now)
        if args.slack:
            print(render_slack(result))
        elif args.html:
            print(render_html(result))
        else:
            print(json.dumps(result, indent=2, sort_keys=True, ensure_ascii=False))
        return 0
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001 - a debugging CLI: one line, exit 0 like its callers
        log(f"failed: {type(exc).__name__}: {exc}")
        return 0


if __name__ == "__main__":
    sys.exit(main())
