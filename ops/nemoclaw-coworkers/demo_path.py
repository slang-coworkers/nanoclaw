#!/usr/bin/env python3
"""demo_path.py: the demo-path tracker — five rungs, the matrix rows each one needs, and an ETA per
rung computed from the autopilot's live queue state with a deterministic model.

Spec (which rows a rung needs, planning hours, stage factors, manual steps): demo-path.json next to
this file, loaded by load_spec(). Live inputs, all under --root and every one optional (a missing or
broken one renders as "unknown" and the run goes on):

  <ROOT>/data/shared/hermes/autopilot/state.json   hermes_queue.build_state's output: rows[rid].state /
                                                    disposition / batch / paused, gating, wip, supervise.rows[rid].stage
  <ROOT>/data/shared/hermes/autopilot/config.json  the human's knobs: wip, waive, paused_rows, podman_box
  <ROOT>/docs/hermes-port/dispatch-plan.md + gap-matrix.md (fallback data/shared/hermes/) — for
                                                    hermes_queue.dispatch_order, the order rows are dispatched in
  <ROOT>/groups/orchestrator/reports/ledger.md     merge timestamps (the `merged/blocked` cell) for "done <date>"

THE ETA MODEL (deterministic; the same text is rendered as the footnote):

  remaining hours of a row = planning_hours[disposition] × stage_factor[state]
      BUILD 48 h · CONFIGURE 15 h · ADOPT 10 h (measured medians / p80)
      queued 1.0 · dispatched, spec_handoff 0.85 · building 0.6 · pr_open, testing 0.35 · review 0.2 · gate 0.1 · merged 0
  A row is done when merged, or listed in config.waive ("waived": done for the rung, shown as such).
  Open rows are list-scheduled, in hermes_queue.dispatch_order (fallback: the order in demo-path.json),
  onto wip.limit slots starting now: in-flight rows hold their slot for their remaining hours; a BUILD
  row cannot start while another BUILD row runs (the BUILD lane); a row behind a false gate starts when
  the rows that gate requires finish (1a_first_pass ← batch 1a, batch2_merged ← batch 2, batch3_merged
  ← batch 3, batch4_merged ← batch 4); podman_box is a config flag, so a false one makes the rows behind
  it "unknown" with the reason. Paused rows (config.paused_rows) and ledger-blocked rows are excluded
  from every finish time and the rungs that need them are flagged ("blocked by pause" / "blocked").
  A manual item starts when everything in its `after` list (rows, manual items or rungs) has finished
  and lasts `hours` (`hours_max` for the upper end of a range). A row with an `after` list starts no
  earlier than those items finish (its slot is not re-planned). Rung ETA = latest finish over its rows,
  manual items and required rungs; a done rung shows "done <date>" from the ledger's merge stamps
  (else state.json's generated_at).

Public surface (pure functions, no I/O except the two loaders):
  load_spec(path) → dict            load_live(root, …) → dict         compute(spec, live, now_utc) → dict
  render_html(result) → str fragment (rows board)                      render_slack(result) → str (mrkdwn, ≤ 25 lines)
CLI for debugging: python3 demo_path.py --root <ROOT> [--json | --slack | --html] [--now ISO]. Exit 0 always.
Stdlib only; hermes_queue is imported the way rows-board.py imports it (never copied).
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
GATE_BATCH = {"1a_first_pass": "1a", "batch2_merged": "2", "batch3_merged": "3", "batch4_merged": "4"}
CONFIG_GATES = ("podman_box",)
STATUS_LABEL = {
    "done": "done", "in_progress": "in progress", "blocked_by_gate": "blocked by gate",
    "not_started": "not started", "unknown": "unknown",
}
STATUS_CLASS = {"done": "ok", "in_progress": "run", "blocked_by_gate": "open", "not_started": "off", "unknown": "bad"}
STATUS_EMOJI = {"done": "✅", "in_progress": "🔨", "blocked_by_gate": "⏳", "not_started": "▫️", "unknown": "❔"}
ROW_CLASS = {
    "merged": "merged", "waived": "merged", "paused": "stalled", "blocked": "stalled", "unknown": "unknown",
    "queued": "queued", "deferred": "stalled", "carried": "queued",
}
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
_HQ = None


def _rows_board():
    """rows-board.py (a hyphenated filename, so importlib): load_json / load_plan and its hermes_queue import."""
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


def _hermes_queue():
    """The autopilot's parsers and dispatch_order, through rows-board's own import (one code path)."""
    global _HQ
    if _HQ is None:
        _HQ = _rows_board()._hermes_queue()
    return _HQ


def _load_json(path: str) -> tuple:
    """(dict | None, error | None): a missing file is (None, None), like rows-board.load_json."""
    try:
        with open(path, encoding="utf-8") as fh:
            v = json.load(fh)
        return (v, None) if isinstance(v, dict) else (None, f"{os.path.basename(path)} is not an object")
    except FileNotFoundError:
        return None, None
    except (OSError, ValueError) as exc:
        return None, f"{os.path.basename(path)} unreadable: {exc}"


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


# --------------------------------------------------------------------------- live inputs

def _first(paths: list) -> str | None:
    return next((p for p in paths if p and os.path.isfile(p)), None)


def _merge_stamps(ledger_text: str, hq) -> dict:
    """{row-id: ISO merge time} from the ledger's `merged/blocked` cell (first timestamp in it), for
    merged rows only. Header-located columns and the same cell splitter as parse_ledger."""
    out: dict = {}
    main_text, _ = hq._split_ledger_sections(ledger_text)
    tz = hq.DEFAULT_CONFIG.get("install_tz_offset_minutes", 330)
    header = None
    col: dict = {}
    for line in main_text.splitlines():
        if not line.startswith("|"):
            continue
        cells = hq.split_cells(line)
        if not cells or hq.is_separator(cells):
            continue
        if header is None:
            low = [c.lower() for c in cells]
            if any(h in low for h in ("row-id", "req-id", "id")):
                header = low
                col = {name: i for i, name in enumerate(header)}
            continue
        if len(cells) > len(header):
            cells = cells[: len(header) - 1] + ["|".join(cells[len(header) - 1:])]
        id_col = next((col[h] for h in ("row-id", "req-id", "id") if h in col), 0)
        rid, _tokens = hq.ledger_row_id(hq.clean_id(cells[id_col]) if id_col < len(cells) else "")
        i = col.get("merged/blocked")
        if not rid or i is None or i >= len(cells):
            continue
        outcome = hq.parse_outcome_cell(cells[i])
        if outcome.get("outcome") == "merged":
            stamp = hq.first_timestamp(cells[i], tz)
            if stamp:
                out[rid] = stamp
    return out


def load_live(root: str, state_path: str | None = None, config_path: str | None = None, plan_paths: list | None = None,
              matrix_paths: list | None = None, ledger_path: str | None = None) -> dict:
    """Everything compute() needs from the box, each piece independently optional:

    {"state": dict | None, "state_err", "config": dict, "config_err", "order": [(rid, gates)] | None,
     "order_err", "merged_at": {rid: ISO}, "ledger_err", "generated_at": str | None}. Never raises."""
    ap_dir = os.path.join(root, "data", "shared", "hermes", "autopilot")
    out: dict = {"state": None, "state_err": None, "config": {}, "config_err": None, "order": None, "order_err": None,
                 "merged_at": {}, "ledger_err": None, "generated_at": None}
    state, err = _load_json(state_path or os.path.join(ap_dir, "state.json"))
    out["state"], out["state_err"] = state, err
    if state is None and not err:
        out["state_err"] = "state.json not found (the first autopilot tick writes it)"
    if isinstance(state, dict):
        out["generated_at"] = state.get("generated_at")
    cfg, err = _load_json(config_path or os.path.join(ap_dir, "config.json"))
    out["config"], out["config_err"] = (cfg or {}), err
    if cfg is None and not err:
        out["config_err"] = "config.json not found; defaults (wip 3, nothing waived or paused)"

    hq = None
    try:
        hq = _hermes_queue()
    except Exception as exc:  # noqa: BLE001 - the queue module missing is a degraded tracker, not a crash
        out["order_err"] = out["ledger_err"] = f"hermes_queue unavailable: {type(exc).__name__}: {exc}"
        return out

    plan_paths = plan_paths or [os.path.join(root, "docs", "hermes-port", "dispatch-plan.md"),
                                os.path.join(root, "data", "shared", "hermes", "dispatch-plan.md")]
    matrix_paths = matrix_paths or [os.path.join(root, "docs", "hermes-port", "gap-matrix.md"),
                                    os.path.join(root, "data", "shared", "hermes", "gap-matrix.md")]
    plan_file, matrix_file = _first(plan_paths), _first(matrix_paths)
    if not plan_file or not matrix_file:
        out["order_err"] = "dispatch-plan.md / gap-matrix.md not found; using demo-path.json order"
    else:
        try:
            with open(plan_file, encoding="utf-8") as fh:
                plan = hq.parse_plan(fh.read())
            with open(matrix_file, encoding="utf-8") as fh:
                matrix = hq.parse_matrix(fh.read())
            out["order"] = [(str(rid), tuple(gates)) for rid, gates in hq.dispatch_order(plan, matrix)]
            out["plan_rows"] = {rid: {"batch": r.get("batch"), "name": r.get("name")} for rid, r in plan["rows"].items()}
            out["matrix_disposition"] = {rid: r.get("disposition") for rid, r in matrix["rows"].items()}
        except Exception as exc:  # noqa: BLE001
            out["order"] = None
            out["order_err"] = f"dispatch order unavailable ({type(exc).__name__}: {exc}); using demo-path.json order"

    ledger = ledger_path or os.path.join(root, "groups", "orchestrator", "reports", "ledger.md")
    if not os.path.isfile(ledger):
        out["ledger_err"] = f"ledger.md not found ({ledger}); done dates fall back to state.json"
    else:
        try:
            with open(ledger, encoding="utf-8") as fh:
                out["merged_at"] = _merge_stamps(fh.read(), hq)
        except Exception as exc:  # noqa: BLE001
            out["ledger_err"] = f"ledger.md unreadable: {type(exc).__name__}: {exc}"
    return out


# --------------------------------------------------------------------------- compute

def _row_info(rid: str, spec_kind: str | None, live: dict, spec: dict, waive: set, paused: set) -> dict:
    """One row's live facts: effective state, disposition, batch, remaining hours, done / stalled / in_flight."""
    state = live.get("state") if isinstance(live.get("state"), dict) else None
    rows = (state or {}).get("rows") if isinstance((state or {}).get("rows"), dict) else {}
    sup = ((state or {}).get("supervise") or {}).get("rows") if isinstance(state, dict) else None
    sup_row = (sup or {}).get(rid) if isinstance(sup, dict) else None
    row = rows.get(rid) if isinstance(rows.get(rid), dict) else None
    factors = spec["stage_factors"]
    info: dict = {"id": rid, "state": "unknown", "disposition": None, "batch": None, "remaining": None,
                  "done": False, "stalled": None, "in_flight": False, "label": "unknown", "reason": None}
    if state is None:
        info["reason"] = "state.json unavailable"
        return info
    if row is None:
        info["reason"] = "not in state.json"
        return info
    st = str(row.get("state") or "queued")
    stage = str((sup_row or {}).get("stage") or "") if isinstance(sup_row, dict) else ""
    if stage in factors and st in IN_FLIGHT_STATES and stage in IN_FLIGHT_STATES:
        st = stage  # the supervisor's finer stage wins while the row is in flight
    disp = str(row.get("disposition") or (live.get("matrix_disposition") or {}).get(rid) or spec_kind or "").upper() or None
    info.update({"state": st, "disposition": disp, "batch": row.get("batch") or (live.get("plan_rows") or {}).get(rid, {}).get("batch")})
    if st == "merged":
        info.update({"done": True, "remaining": 0.0, "label": "merged"})
    elif rid in waive:
        info.update({"done": True, "remaining": 0.0, "label": "waived", "state": "waived"})
    elif rid in paused or row.get("paused"):
        info.update({"stalled": "paused", "label": "paused", "state": "paused"})
    elif st == "blocked":
        info.update({"stalled": "blocked", "label": "blocked", "reason": row.get("state_reason")})
    elif st == "deferred":
        info.update({"stalled": "deferred", "label": "deferred"})
    else:
        base = spec["planning_hours"].get(disp or "")
        factor = factors.get(st, 1.0)
        info["remaining"] = None if base is None else round(base * factor, 2)
        info["in_flight"] = st in IN_FLIGHT_STATES
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
    build_free = now
    for rid, _ in order:
        info = infos[rid]
        if info["done"]:
            finish[rid] = now  # already merged: the floor for any gate that depends on it
        elif info["in_flight"] and info["remaining"] is not None:
            start[rid] = now
            finish[rid] = now + hours(info["remaining"])
            busy.append(finish[rid])
            if info["disposition"] == "BUILD":
                build_free = max(build_free, finish[rid])
    busy.sort()
    if len(busy) > wip_limit:  # more in flight than the limit: new rows start only once running < limit
        busy = busy[len(busy) - wip_limit:]
    slots = busy + [now] * (wip_limit - len(busy))

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
        ready = now
        waits = []
        unknowable = None
        for g in gates:
            t, why = gate_ready(g)
            if t is None:
                unknowable = f"gate {g}: {why}"
                break
            if t > now:
                waits.append(g)
            ready = max(ready, t)
        if unknowable:
            blockers[rid].append(unknowable)
            continue
        if waits:
            blockers[rid].append("waits for " + ", ".join(waits))
        for g in gates:
            if gating.get(g):
                continue
            for r in by_batch.get(GATE_BATCH.get(g, ""), []):
                if infos[r]["stalled"]:
                    gate_stalled[rid].append((r, infos[r]["stalled"], g))
                    blockers[rid].append(f"{r} {infos[r]['stalled']} in gate {g}")
        i = min(range(len(slots)), key=lambda k: slots[k])
        s = max(slots[i], ready)
        if info["disposition"] == "BUILD":
            s = max(s, build_free)
        f = s + hours(info["remaining"])
        slots[i] = f
        if info["disposition"] == "BUILD":
            build_free = f
        start[rid], finish[rid] = s, f
    return start, finish, blockers, gate_stalled


def compute(spec: dict, live: dict, now_utc: datetime) -> dict:
    """The tracker: {generated_at, source, wip_limit, order_source, rungs: [...], model_notes}. Pure; never raises
    on missing live pieces (they become "unknown"), only on a structurally broken spec."""
    now = now_utc.astimezone(timezone.utc) if now_utc.tzinfo else now_utc.replace(tzinfo=timezone.utc)
    state = live.get("state") if isinstance(live.get("state"), dict) else None
    cfg = live.get("config") if isinstance(live.get("config"), dict) else {}
    gating = (state or {}).get("gating") if isinstance((state or {}).get("gating"), dict) else {}
    waive = {str(x) for x in (cfg.get("waive") or gating.get("waived") or [])}
    paused = {str(x) for x in (cfg.get("paused_rows") or [])}
    try:
        wip_limit = max(1, int(cfg.get("wip") if cfg.get("wip") is not None else ((state or {}).get("wip") or {}).get("limit") or DEFAULT_WIP))
    except (TypeError, ValueError):
        wip_limit = DEFAULT_WIP
    generated_at = parse_iso(live.get("generated_at"))
    merged_at = live.get("merged_at") if isinstance(live.get("merged_at"), dict) else {}

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
    order_source = "hermes_queue.dispatch_order" if order else "demo-path.json"
    if not order:
        order = [(rid, ()) for rid in spec_row_ids]
    live_rows = (state or {}).get("rows") if isinstance((state or {}).get("rows"), dict) else {}
    # Every row the queue knows competes for slots; rows the state does not know cannot be scheduled.
    sim_order = [(rid, tuple(g)) for rid, g in order if rid in live_rows] if state is not None else []
    infos = {rid: _row_info(rid, spec_kind.get(rid), live, spec, waive, paused) for rid, _ in sim_order}
    for rid in spec_row_ids:
        if rid not in infos:
            infos[rid] = _row_info(rid, spec_kind.get(rid), live, spec, waive, paused)
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
                "batch": info.get("batch"), "done": info["done"], "in_flight": info["in_flight"],
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
        if state is None:
            status = "unknown"
        elif done:
            status = "done"
        else:
            started = any(x["done"] or x["in_flight"] for x in rows_out) or any(x["done"] for x in manual_out)
            open_rows = [x for x in rows_out if not x["done"] and x["state"] not in ("unknown", "paused", "blocked", "deferred")]
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

    source_errs = [live.get(k) for k in ("state_err", "config_err", "order_err", "ledger_err") if live.get(k)]
    return {
        "generated_at": iso(now),
        "state_generated_at": live.get("generated_at"),
        "state_ok": state is not None,
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
            f"onto {wip_limit} WIP slots from now, one BUILD in flight at a time, gated rows start when their gate's rows finish; "
            f"paused / blocked rows excluded and flagged; manual items start when their prerequisites finish. "
            + (spec.get("notes") or ""))


# --------------------------------------------------------------------------- renderers

def _esc(s) -> str:
    return html.escape(str(s if s is not None else ""), quote=True)


def _row_class(row: dict) -> str:
    if row.get("done"):
        return "merged"
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
    out.append('<p class="muted">Five rungs to the demo; each needs specific matrix rows. Status and ETA come from the autopilot\'s '
               'live queue state through a deterministic model (footnote below). Dates are UTC.</p>')
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
              "paused/blocked rows excluded and flagged; details on the rows board_")
    lines = lines[: SLACK_MAX_LINES - 1]
    lines.append(footer)
    return "\n".join(lines)


def _squash(s, n: int) -> str:
    s = re.sub(r"\s+", " ", str(s if s is not None else "")).strip()
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


# --------------------------------------------------------------------------- cli

def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Demo path tracker: rung status + ETA from the autopilot's live queue state.")
    ap.add_argument("--root", default=os.environ.get("NANOCLAW_ROOT") or os.getcwd(), help="nanoclaw checkout (data/, docs/, groups/)")
    ap.add_argument("--spec", default=os.environ.get("DEMO_PATH_SPEC") or SPEC_PATH, help="demo-path.json (default: next to this script)")
    ap.add_argument("--state", default=None, help="state.json override")
    ap.add_argument("--config", default=None, help="config.json override")
    ap.add_argument("--now", default=None, help="ISO timestamp (tests)")
    fmt = ap.add_mutually_exclusive_group()
    fmt.add_argument("--json", action="store_true", help="print compute() as JSON (default)")
    fmt.add_argument("--slack", action="store_true", help="print the Slack mrkdwn text")
    fmt.add_argument("--html", action="store_true", help="print the rows-board HTML fragment")
    try:
        args = ap.parse_args(argv)
        now = parse_iso(args.now) or datetime.now(timezone.utc)
        spec = load_spec(args.spec)
        live = load_live(os.path.abspath(args.root), state_path=args.state, config_path=args.config)
        result = compute(spec, live, now)
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
