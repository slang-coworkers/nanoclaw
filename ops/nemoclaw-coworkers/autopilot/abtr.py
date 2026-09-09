#!/usr/bin/env python3
"""abtr.py: the one-line-per-row a | b | t | r report (architect, builder, tester, reviewer,
gate) rendered as compact markdown. Pure: state.json + the parsed ledger rows + a fixed `now`
in, one string out. scorecard.py is the CLI (`--markdown [PATH]`, `--brief [PATH]`);
pull-state.sh writes the file every tick at reports/status/autopilot.md (viewer: /status/).

Cells, one token plus an optional time or age:
  ✓ 09:57Z    done; the time of the hand-off or artifact (dated `MM-DD HH:MMZ` when not today)
  ✓▶ 2.0h     architect: [Spec handoff] seen, the forward to the builder still owed
  ▶ 3.6h      active: hours since the stage began (the SLO clock)
  ▶ r2 3.1h   tester active on round 2
  ✗ FAIL r2   tester FAIL round 2 / ✗ RC r1 reviewer REQUEST_CHANGES round 1
  ⚠ ESC r1    tester ESCALATE (environmental, not a counted round)
  ⏸           paused row or cost hold on the active role
  ·           not started
  gate: ✓ <sha7> merged · ✗ <reason> blocked · ▶ <age> at the merge gate · ⏸ <hold> held

Stage logic is the one scorecard.py already uses: the supervisor's row in state.json
(`supervise.rows`) first, then the queue's row (`rows`), then the ledger columns alone.
"""

from __future__ import annotations

import os
import re
from datetime import datetime, timezone

MAX_LINE = 110
NOTE_MAX = 60
NOTE_MIN = 12
GATE_REASON_MAX = 26
ALERT_WINDOW_H = 6.0
NOTE_ALERT_WINDOW_H = 24.0
DEFAULT_DISPATCHABLE = 30
STAGES = ("queued", "dispatched", "spec_handoff", "building", "pr_open", "testing", "review", "gate", "merged")
IN_FLIGHT = ("dispatched", "spec_handoff", "building", "pr_open", "testing", "review", "gate")
VERDICT_TOKEN_RE = re.compile(r"\b(PASS|FAIL|APPROVE|REQUEST_CHANGES)\b")
ROUND_RE = re.compile(r"(?i)\bround\s+(\d)")
BATCH_RE = re.compile(r"\b[Bb]atch\s+(\d[a-z]?)\b")
MERGED_SHA_RE = re.compile(r"merged.{0,60}?\b([0-9a-f]{7,40})\b", re.IGNORECASE | re.DOTALL)
BLOCKED_REASON_RE = re.compile(r"blocked:\s*(.*)", re.IGNORECASE | re.DOTALL)
HEADER_PREFIX = "Hermes autopilot"
LEGEND = (
    "a architect · b builder · t tester · r reviewer · gate merge gate",
    "✓ done HH:MMZ · ✓▶ done, forward owed · ▶ active h · ✗ FAIL/RC round · ⚠ ESC · ⏸ paused/cost · · not started",
)
# stage -> (nudge after h, role owing the next artifact): hermes_supervise.SLO, for a state.json that predates those keys
SLO_FALLBACK = {
    "dispatched": (6, "hermes-architect"), "spec_handoff": (2, "hermes-architect"), "building": (8, "hermes-builder"),
    "pr_open": (2, "hermes-builder"), "testing": (6, "hermes-tester"), "review": (4, "hermes-reviewer"), "gate": (4, "hermes-architect"),
}
TABLE_HEADER = "| row | batch | a | b | t | r | gate | note |"
TABLE_RULE = "|---|---|---|---|---|---|---|---|"


# --------------------------------------------------------------------------- small helpers

def parse_iso(value):
    if not value or not isinstance(value, str):
        return None
    v = value.strip()
    if v.endswith(("Z", "z")):
        v = v[:-1] + "+00:00"
    v = re.sub(r"(\.\d{6})\d+", r"\1", v)
    try:
        dt = datetime.fromisoformat(v)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def hours_since(now: datetime, iso) -> float | None:
    dt = parse_iso(iso)
    if dt is None:
        return None
    return max(0.0, round((now - dt).total_seconds() / 3600.0, 1))


def fmt_age(h) -> str:
    return "?h" if h is None else f"{h:.1f}h"


def fmt_time(iso, now: datetime) -> str:
    """HH:MMZ, prefixed with MM-DD when the stamp is not on now's UTC date."""
    dt = parse_iso(iso)
    if dt is None:
        return ""
    if dt.date() == now.date():
        return dt.strftime("%H:%MZ")
    return dt.strftime("%m-%d %H:%MZ")


def clean_text(text) -> str:
    t = " ".join(str(text or "").replace("|", "\\|").split())
    return t.replace("**", "").replace("`", "")


def trunc(text: str, width: int) -> str:
    text = text or ""
    if len(text) <= width:
        return text
    return text[: max(0, width - 1)].rstrip() + "…"


def _num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


# --------------------------------------------------------------------------- per-row view

def ledger_rounds(verdict_cell: str) -> tuple[list, list]:
    """Cross-check reading of the ledger's verdict cell: `round 2/2 FAIL` -> one test round;
    APPROVE / REQUEST_CHANGES -> one review round. The threads are authoritative when present."""
    tokens = VERDICT_TOKEN_RE.findall(verdict_cell or "")
    rounds = [int(r) for r in ROUND_RE.findall(verdict_cell or "")]
    if not tokens:
        return [], []
    n = rounds[-1] if rounds else None
    last = tokens[-1]
    if last in ("APPROVE", "REQUEST_CHANGES"):
        tests = [{"round": n, "verdict": "PASS", "ts": None}] if "PASS" in tokens else []
        return tests, [{"round": n, "verdict": last, "ts": None}]
    return [{"round": n, "verdict": last, "ts": None}], []


def ledger_stage(lr: dict, tests: list, reviews: list) -> str:
    """Coarse stage from the ledger alone (hermes_queue.ledger_state's reading)."""
    outcome = lr.get("outcome")
    if outcome in ("merged", "blocked"):
        return outcome
    if lr.get("pr"):
        if reviews and reviews[-1]["verdict"] == "APPROVE":
            return "gate"
        if reviews:
            return "building"
        if tests and tests[-1]["verdict"] == "PASS":
            return "review"
        if tests and tests[-1]["verdict"] == "FAIL":
            return "building"
        return "pr_open"
    if lr.get("spec_accepted_at"):
        return "spec_handoff"
    return "dispatched"


def _find_pr(prs, rid: str, pr_no):
    tag = f"[{rid}]"
    branch = f"plugin/{rid.lower()}"
    for p in prs or []:
        if not isinstance(p, dict):
            continue
        if tag in (p.get("title") or "") or (p.get("headRefName") or "") == branch:
            return p
    if pr_no is not None:
        for p in prs or []:
            if isinstance(p, dict) and p.get("number") == pr_no:
                return p
    return None


def _alert_what(rest: str) -> str:
    """`state h · what · nudged ...` -> `state h · what`."""
    parts = [p.strip() for p in (rest or "").split(" · ")]
    return " · ".join(p for p in parts[:2] if p)


def row_view(rid: str, lr: dict | None, qrow: dict | None, srow: dict | None, now: datetime,
             prs=(), config: dict | None = None, alerts=(), state_alerts=()) -> dict:
    """One row's cells and note from the three sources, supervisor first."""
    lr = lr or {}
    qrow = qrow or {}
    srow = srow or {}
    cfg = config or {}
    qledger = qrow.get("ledger") if isinstance(qrow.get("ledger"), dict) else {}

    verdict_cell = lr.get("verdict") or ""
    l_tests, l_reviews = ledger_rounds(verdict_cell)
    tests = srow.get("test_rounds") if isinstance(srow.get("test_rounds"), list) and srow.get("test_rounds") else l_tests
    reviews = srow.get("review_rounds") if isinstance(srow.get("review_rounds"), list) and srow.get("review_rounds") else l_reviews

    if srow.get("stage"):
        stage = srow["stage"]
    elif qrow.get("state") in IN_FLIGHT + ("merged", "blocked"):
        stage = qrow["state"]
    else:
        stage = ledger_stage(lr, l_tests, l_reviews)
    if stage not in STAGES and stage != "blocked":
        stage = "dispatched"
    group = "merged" if stage == "merged" else "blocked" if stage == "blocked" else "in_flight"

    pr_no = srow.get("pr") or qledger.get("pr") or lr.get("pr")
    pr = _find_pr(prs, rid, pr_no)
    if pr and pr_no is None:
        pr_no = pr.get("number")

    clock = srow.get("clock_start") or qrow.get("since") or qledger.get("spec_accepted_at") or lr.get("spec_accepted_at") \
        or qrow.get("dispatched_at") or qledger.get("dispatched_at") or lr.get("dispatched_at")
    age = _num(srow.get("age_hours"))
    if age is None:
        age = hours_since(now, clock)
    elif age is not None:
        age = round(float(age), 1)

    paused = rid in (cfg.get("paused_rows") or []) or srow.get("hold") == "paused" or bool(qrow.get("paused"))
    cost_hold = bool(srow.get("cost_hold"))
    hold = srow.get("hold") if srow.get("hold") not in (None, "paused") else None
    frozen = paused or cost_hold

    spec_at = lr.get("spec_accepted_at") or qledger.get("spec_accepted_at")
    if not spec_at and stage == "spec_handoff":
        spec_at = srow.get("clock_start")
    pr_created = (pr or {}).get("createdAt")
    idx = STAGES.index(stage) if stage in STAGES else -1
    past = idx >= STAGES.index("building") or group in ("merged", "blocked")

    def active(extra: str = "") -> str:
        if frozen:
            return "⏸"
        return f"▶ {extra}{fmt_age(age)}"

    def done(iso=None) -> str:
        t = fmt_time(iso, now) if iso and group == "in_flight" else ""  # merged / blocked rows stay compact
        return f"✓ {t}" if t else "✓"

    # a: architect
    if stage == "dispatched":
        a = active()
    elif stage == "spec_handoff":
        a = "⏸" if frozen else f"✓▶ {fmt_age(age)}"
    elif past and (spec_at or idx >= STAGES.index("building") or group == "merged"):
        a = done(spec_at)
    else:
        a = "·"
    # b: builder
    if stage in ("building", "pr_open"):
        b = active()
    elif idx >= STAGES.index("testing") or group == "merged" or (group == "blocked" and pr_no):
        b = done(pr_created)
    else:
        b = "·"
    # t: tester
    last_t = tests[-1] if tests else None
    if stage == "testing":
        k = srow.get("round") or (last_t or {}).get("round")
        t = active(f"r{k} " if k and k > 1 else "")
    elif last_t and last_t.get("verdict") == "FAIL":
        t = f"✗ FAIL r{last_t.get('round') or '?'}"
    elif last_t and last_t.get("verdict") == "ESCALATE":
        t = f"⚠ ESC r{last_t.get('round') or '?'}"
    elif last_t and last_t.get("verdict") == "PASS":
        t = done(last_t.get("ts"))
    elif stage in ("review", "gate") or group == "merged":
        t = "✓"
    else:
        t = "·"
    # r: reviewer
    last_r = reviews[-1] if reviews else None
    if stage == "review":
        r = active()
    elif last_r and last_r.get("verdict") == "REQUEST_CHANGES":
        r = f"✗ RC r{last_r.get('round') or '?'}"
    elif last_r and last_r.get("verdict") == "APPROVE":
        r = done(last_r.get("ts"))
    elif stage == "gate" or group == "merged":
        r = "✓"
    else:
        r = "·"
    # gate
    outcome_cell = lr.get("outcome_cell") or ""
    if group == "merged":
        m = MERGED_SHA_RE.search(outcome_cell)
        sha = (m.group(1)[:7] if m else ((pr or {}).get("mergeCommit") or {}).get("oid", "")[:7]) or "merged"
        gate = f"✓ {sha}"
    elif group == "blocked":
        m = BLOCKED_REASON_RE.search(outcome_cell)
        reason = m.group(1) if m else (srow.get("reason") or qrow.get("state_reason") or "blocked")
        gate = f"✗ {trunc(clean_text(reason), GATE_REASON_MAX)}"
    elif stage == "gate":
        gate = f"⏸ {hold}" if hold else active()
    else:
        gate = "·"

    # batch
    batch = qrow.get("batch") or ""
    if not batch:
        m = BATCH_RE.search(lr.get("notes") or "")
        batch = m.group(1) if m else "·"

    # note: the latest breach / alert for the row, else the ledger's short note
    note = ""
    if cost_hold:
        cs = (srow.get("cost_hold_sessions") or [{}])[0]
        note = f"cost hold: {cs.get('role') or 'a role'} {cs.get('cost_status') or ''}".strip()
    elif paused:
        note = "paused"
    if not note and srow.get("alert_line"):
        parts = [p.strip() for p in srow["alert_line"].split(" · ")]
        what = parts[3] if len(parts) > 3 else ""
        note = f"alert {srow.get('alert_kind') or ''}: {what}".replace(" :", ":")
    if not note and srow.get("slo_status") in ("breached", "nudged") and stage in IN_FLIGHT:
        label = srow.get("stage_label") or stage
        fb_h, fb_role = SLO_FALLBACK.get(stage, (None, None))
        after = _num(srow.get("nudge_after_h")) or fb_h
        role = srow.get("target_role") or fb_role
        verb = "nudge" if srow.get("action") == "nudge" else srow["slo_status"]
        note = f"SLO {label} {fmt_age(age)} > {after:g}h: {verb}" if after is not None else f"SLO {label} {fmt_age(age)}: {verb}"
        if role:
            note += f" {role}"
    if not note:
        for a_ in state_alerts:
            if isinstance(a_, dict) and a_.get("row") == rid and a_.get("kind"):
                note = f"{a_['kind']}: {clean_text(a_.get('detail') or a_.get('line') or '')}"
                break
    if not note:
        for a_ in alerts:  # newest first
            if a_.get("row") == rid:
                h = hours_since(now, a_.get("at"))
                if h is not None and h <= NOTE_ALERT_WINDOW_H:
                    note = f"alert: {_alert_what(a_.get('rest') or '')}"
                break
    if not note and group == "in_flight" and hold:
        note = f"hold: {hold}"
    if not note and group != "merged":
        base = clean_text(lr.get("notes") or qrow.get("state_reason") or qrow.get("name") or "")
        if group == "in_flight":
            label = srow.get("stage_label") or stage
            if not base:
                note = label
            elif base.lower().startswith(stage.lower()):  # a queue state_reason already names the stage
                note = base
            else:
                note = f"{label} · {base}"
        else:
            note = base
    note = clean_text(note)

    return {
        "id": rid,
        "batch": str(batch),
        "group": group,
        "stage": stage,
        "age_h": age,
        "cells": {"a": a, "b": b, "t": t, "r": r, "gate": gate},
        "note": note,
        "pr": pr_no,
    }


# --------------------------------------------------------------------------- the report

def derive_rows(state: dict, ledger_rows: dict, now: datetime, prs=(), alerts=(), config: dict | None = None) -> list:
    state = state if isinstance(state, dict) else {}
    ledger_rows = ledger_rows if isinstance(ledger_rows, dict) else {}
    sup = (state.get("supervise") or {}).get("rows") if isinstance(state.get("supervise"), dict) else {}
    sup = sup if isinstance(sup, dict) else {}
    qrows = state.get("rows") if isinstance(state.get("rows"), dict) else {}
    cfg = config if isinstance(config, dict) else (state.get("config") if isinstance(state.get("config"), dict) else {})
    state_alerts = state.get("alerts") if isinstance(state.get("alerts"), list) else []

    ids = set(ledger_rows)
    ids.update(r for r in (state.get("in_flight") or []) if isinstance(r, str))
    ids.update(rid for rid, q in qrows.items() if isinstance(q, dict) and q.get("state") in IN_FLIGHT + ("merged", "blocked"))
    ids.update(rid for rid, s in sup.items() if isinstance(s, dict) and s.get("stage") in IN_FLIGHT + ("merged", "blocked"))

    views = [
        row_view(rid, ledger_rows.get(rid), qrows.get(rid), sup.get(rid), now, prs, cfg, alerts, state_alerts)
        for rid in sorted(ids)
    ]
    in_flight = sorted((v for v in views if v["group"] == "in_flight"), key=lambda v: (-(v["age_h"] if v["age_h"] is not None else -1), v["id"]))
    blocked = [v for v in views if v["group"] == "blocked"]
    merged = [v for v in views if v["group"] == "merged"]
    return in_flight + blocked + merged


def queued_summary(state: dict, ledger_rows: dict, dispatchable=None) -> tuple[int, list, list]:
    """(queued count, next eligible ids, waiting ids)."""
    state = state if isinstance(state, dict) else {}
    qrows = state.get("rows") if isinstance(state.get("rows"), dict) else {}
    # The queue's rows carry a plan disposition for every matrix row; anything else is a partial
    # state (ledger fallback, a fixture), and the count comes from the plan instead.
    full_queue = any(isinstance(q, dict) and q.get("disposition") for q in qrows.values())
    if full_queue:
        n = sum(1 for q in qrows.values() if isinstance(q, dict) and q.get("state") == "queued")
    else:
        n = max(0, (dispatchable or DEFAULT_DISPATCHABLE) - len(ledger_rows or {}))
    nxt = [(e.get("id") or e.get("row")) if isinstance(e, dict) else str(e) for e in (state.get("eligible_next") or [])]
    waiting = [(w.get("id") if isinstance(w, dict) else str(w)) for w in ((state.get("queue") or {}).get("waiting") or [])]
    return n, [x for x in nxt if x][:3], [x for x in waiting if x][:3]


def header_line(state: dict, rows: list, now: datetime, alerts=(), config: dict | None = None, dispatchable=None, ledger_rows=None) -> str:
    state = state if isinstance(state, dict) else {}
    cfg = config if isinstance(config, dict) else (state.get("config") if isinstance(state.get("config"), dict) else {})
    wip = state.get("wip")
    limit = cfg.get("wip") or (wip.get("limit") if isinstance(wip, dict) else wip) or 3
    tick = state.get("generated_at") or now.strftime("%Y-%m-%dT%H:%M:%SZ")
    n_if = sum(1 for v in rows if v["group"] == "in_flight")
    n_m = sum(1 for v in rows if v["group"] == "merged")
    n_b = sum(1 for v in rows if v["group"] == "blocked")
    queued, _, _ = queued_summary(state, ledger_rows or {}, dispatchable)
    recent = 0
    for a in alerts or ():
        h = hours_since(now, a.get("at"))
        if h is not None and h <= ALERT_WINDOW_H:
            recent += 1
    line = (
        f"{HEADER_PREFIX} · {tick} · in flight {n_if}/{limit} · merged {n_m} · blocked {n_b}"
        f" · queued {queued} · alerts 6h {recent}"
    )
    if cfg.get("paused") or state.get("paused"):
        line += " · DISPATCH PAUSED"
    return line


def table_line(v: dict) -> str:
    c = v["cells"]
    prefix = f"| {v['id']} | {v['batch']} | {c['a']} | {c['b']} | {c['t']} | {c['r']} | {c['gate']} | "
    budget = min(NOTE_MAX, max(NOTE_MIN, MAX_LINE - len(prefix) - 2))
    return prefix + trunc(v["note"], budget) + " |"


def render_abtr_markdown(state: dict, ledger_rows: dict, now: datetime, prs=(), alerts=(), config: dict | None = None, dispatchable=None) -> str:
    rows = derive_rows(state, ledger_rows, now, prs, alerts, config)
    out = [header_line(state, rows, now, alerts, config, dispatchable, ledger_rows), *LEGEND, "", TABLE_HEADER, TABLE_RULE]
    out.extend(table_line(v) for v in rows)
    if not rows:
        out.append("| · | · | · | · | · | · | · | no rows in the ledger or the state |")
    n, nxt, waiting = queued_summary(state, ledger_rows, dispatchable)
    if nxt:
        tail = f"next: {', '.join(nxt)}"
    elif waiting:
        tail = f"next: none eligible; waiting: {', '.join(waiting)}"
    else:
        tail = "next: none"
    out.append("")
    out.append(f"queued: {n} rows ({tail})")
    return "\n".join(out) + "\n"


def render_abtr_brief(state: dict, ledger_rows: dict, now: datetime, prs=(), alerts=(), config: dict | None = None, dispatchable=None,
                      link: str = "/status/autopilot.md") -> str:
    """The tick's report: the header, one `<row> | a | b | t | r` line per in-flight row, the link."""
    rows = derive_rows(state, ledger_rows, now, prs, alerts, config)
    out = [header_line(state, rows, now, alerts, config, dispatchable, ledger_rows)]
    for v in rows:
        if v["group"] != "in_flight":
            continue
        c = v["cells"]
        line = f"{v['id']} | {c['a']} | {c['b']} | {c['t']} | {c['r']}"
        if c["gate"] != "·":
            line += f" | gate {c['gate']}"
        out.append(line)
    if len(out) == 1:
        out.append("no rows in flight")
    out.append(f"full table: {link}")
    return "\n".join(out) + "\n"


def write_atomic(path: str, text: str) -> None:
    d = os.path.dirname(os.path.abspath(path))
    os.makedirs(d, exist_ok=True)
    tmp = os.path.join(d, f".{os.path.basename(path)}.tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write(text)
    os.replace(tmp, path)
