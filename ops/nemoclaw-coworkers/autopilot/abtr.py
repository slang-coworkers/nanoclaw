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
  ⚠ ENV r2    tester FAIL (env) (environmental, not a counted round either — round caps v2)
  ⏸           paused row or cost hold on the active role
  ·           not started
  gate: ✓ <sha7> merged · ✗ <reason> blocked · ▶ <age> at the merge gate · ⏸ <hold> held

Stage logic is the one scorecard.py already uses: the supervisor's row in state.json
(`supervise.rows`) first, then the queue's row (`rows`), then the ledger columns alone.

Standing operator asks (state.json `operator_asks`, from the supervisor's §2.5 operator_ask
detection) render right under the header in both outputs, one line each, so the tick report
and the human check lead with the decisions the operator owes:
  DECISION NEEDED (14h): ISO-F14 — render COMPLETE & verified; sandbox tier blocked on 2 new …
(the head is clipped to MAX_LINE here; the alert's status line on hermes-status carries the
full 140 chars).
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
DEFAULT_DISPATCHABLE = 33  # dispatched rows on the plan's coverage line when no count is passed; 31 since FLEET-F62 (2026-09-16), 33 since OSH-F63/F64 (2026-09-17)
# keep in step with scorecard.DEFAULT_DISPATCHABLE (scorecard imports this module, so it cannot be imported from there)
STAGES = ("queued", "dispatched", "spec_handoff", "building", "pr_open", "testing", "review", "gate", "merged")
IN_FLIGHT = ("dispatched", "spec_handoff", "building", "pr_open", "testing", "review", "gate")
VERDICT_TOKEN_RE = re.compile(r"\b(PASS|FAIL|APPROVE|REQUEST_CHANGES)\b")
ENV_AFTER_RE = re.compile(r"(?i)[^(\n]{0,16}\(\s*(?:env|environmental|outside[- ]plugin|infra)")  # `FAIL (env)`, `FAIL ×8 (env)`
MD_STRIP_RE = re.compile(r"[*_`~]+")
# where the Orchestrator's free-text closure starts a clause in a stamp's absorbed question (hermes_queue.ANSWERED_RE's twin)
ANSWERED_CLAUSE_RE = re.compile(r"(?i)(?:^|[;:.?!—–(\n]|\s-)\s*(?:answered|default\s+applied)\b")
WORD_RE = re.compile(r"[a-z0-9]+")  # the words of a question, for _same_question's word-subset net
ROUND_RE = re.compile(r"(?i)\bround\s+(\d)")
BATCH_RE = re.compile(r"\b[Bb]atch\s+(\d[a-z]?)\b")
MERGED_SHA_RE = re.compile(r"merged.{0,60}?\b([0-9a-f]{7,40})\b", re.IGNORECASE | re.DOTALL)
BLOCKED_REASON_RE = re.compile(r"blocked:\s*(.*)", re.IGNORECASE | re.DOTALL)
HEADER_PREFIX = "Hermes autopilot"
LEGEND = (
    "a architect · b builder · t tester · r reviewer · gate merge gate",
    "✓ done HH:MMZ · ✓▶ done, forward owed · ▶ active h · ✗ FAIL/RC round · ⚠ ESC/ENV · ⏸ paused/cost · · not started",
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


TITLE_WIDTH = 34
_TITLE_CUT_RE = re.compile(r"\s*(?:\(|:| — | - |, |;| via | with ).*$")


def short_title(name) -> str:
    """The row's name as the brief prints it after the id: `RT-F09 · Pluggable router seams`. The matrix names
    are sentences ("Pluggable router seams (interceptors, gates, session-created hooks)"); the operator asked for
    something a human recognises in Slack, so the first clause (before a parenthesis, colon, dash or comma) is
    kept, a follow-up's `follow-up of <ID>: ` prefix is dropped, and the result is clipped to TITLE_WIDTH."""
    t = clean_text(name)
    t = re.sub(r"^follow-up of [^:]+:\s*", "", t)
    first = _TITLE_CUT_RE.sub("", t).strip()
    if len(first) < 8:  # a first clause that is just a word or two: keep more of the sentence
        first = t
    return trunc(first, TITLE_WIDTH)


def _num(v):
    return v if isinstance(v, (int, float)) and not isinstance(v, bool) else None


# --------------------------------------------------------------------------- per-row view

def ledger_rounds(verdict_cell: str) -> tuple[list, list]:
    """Cross-check reading of the ledger's verdict cell: `round 2/2 FAIL` -> one test round;
    APPROVE / REQUEST_CHANGES -> one review round; a `FAIL (env)` / `FAIL(env)` last token is
    `FAIL_ENV` (round caps v2: environmental, not a counted round). The threads are authoritative when present."""
    cell = verdict_cell or ""
    matches = list(VERDICT_TOKEN_RE.finditer(cell))
    tokens = [m.group(1) for m in matches]
    rounds = [int(r) for r in ROUND_RE.findall(cell)]
    if not tokens:
        return [], []
    n = rounds[-1] if rounds else None
    last = tokens[-1]
    if last in ("APPROVE", "REQUEST_CHANGES"):
        tests = [{"round": n, "verdict": "PASS", "ts": None}] if "PASS" in tokens else []
        return tests, [{"round": n, "verdict": last, "ts": None}]
    if last == "FAIL" and ENV_AFTER_RE.match(cell, matches[-1].end()):
        last = "FAIL_ENV"
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
        if tests and tests[-1]["verdict"] == "FAIL_ENV":
            return "testing"  # the tester still owes a counted round; the builder has nothing to fix
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
    elif last_t and last_t.get("verdict") == "FAIL_ENV":
        t = f"⚠ ENV r{last_t.get('round') or '?'}"  # environmental FAIL: not a counted round (round caps v2), never `·`
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
        "title": short_title(qrow.get("name")),
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


def fmt_tick(iso, now: datetime) -> str:
    """The header's tick stamp as `MM-DD HH:MMZ` (the cells' dated form) so the header, with
    its `cards 24h` token, stays inside MAX_LINE; an unparsable stamp is shown as given."""
    dt = parse_iso(iso) if isinstance(iso, str) else None
    if dt is None:
        return iso if isinstance(iso, str) and iso else now.strftime("%m-%d %H:%MZ")
    return dt.astimezone(timezone.utc).strftime("%m-%d %H:%MZ")


def header_line(state: dict, rows: list, now: datetime, alerts=(), config: dict | None = None, dispatchable=None, ledger_rows=None,
                cards_24h=None) -> str:
    """`cards_24h`: count of task-card PNGs written in the last 24 h (scorecard.count_recent_cards);
    None renders `?` (the caller had no card directory to count)."""
    state = state if isinstance(state, dict) else {}
    cfg = config if isinstance(config, dict) else (state.get("config") if isinstance(state.get("config"), dict) else {})
    wip = state.get("wip")
    limit = cfg.get("wip") or (wip.get("limit") if isinstance(wip, dict) else wip) or 3
    tick = fmt_tick(state.get("generated_at"), now)
    n_if = sum(1 for v in rows if v["group"] == "in_flight")
    n_m = sum(1 for v in rows if v["group"] == "merged")
    n_b = sum(1 for v in rows if v["group"] == "blocked")
    queued, _, _ = queued_summary(state, ledger_rows or {}, dispatchable)
    recent = 0
    for a in alerts or ():
        h = hours_since(now, a.get("at"))
        if h is not None and h <= ALERT_WINDOW_H:
            recent += 1
    cards = cards_24h if isinstance(cards_24h, int) and not isinstance(cards_24h, bool) else "?"
    line = (
        f"{HEADER_PREFIX} · {tick} · in flight {n_if}/{limit} · merged {n_m} · blocked {n_b}"
        f" · queued {queued} · alerts 6h {recent} · cards 24h {cards}"
    )
    if cfg.get("paused") or state.get("paused"):
        line += " · DISPATCH PAUSED"
    return line


def _same_question(a: str, b: str) -> bool:
    """hermes_supervise._same_ask_text + _same_ask_words, mirrored: two questions are one ask when the shorter's head (200
    chars, ≥ 40) is inside the longer, or every word of the shorter (≥ 6 words) is in the longer — a DM copy differing from
    the ledger stamp by a lead-in, a trailing parenthesis or one added mid-sentence ("the sandbox (podman) tier") is the
    same decision; a new question (other words) is not."""
    a, b = " ".join(a.split()).lower(), " ".join(b.split()).lower()
    short, long_ = sorted((a, b), key=len)
    if len(short) >= 40 and short[:200] in long_:
        return True
    ws, wl = sorted((WORD_RE.findall(a), WORD_RE.findall(b)), key=len)
    return len(ws) >= 6 and set(ws) <= set(wl)


def ask_closed(a: dict, state: dict, ledger_rows: dict | None) -> bool:
    """A standing ask the ledger or the row state already closed (hermes_supervise §2.5 closure, mirrored on the report
    side so a state.json written before the supervisor learned the rule renders no stale line): the row is merged /
    dropped (queue state, supervisor stage or the ledger's merged/blocked cell) and the ask is stamp-borne or canonical,
    or the row's ledger notes carry ANSWERED / DEFAULT APPLIED after the ask's stamp (scorecard.decision_stamps
    `answered`) — matched on the stamp's ISO for a stamp-borne ask, and for a DM copy / thread mirror (no `stamp`, a
    `thread_id`) whose words differ from the stamp's: the same question by `_same_question`, or, for a canonical copy,
    the answer's own ISO (`answered_at`) not before the ask. A `OPERATOR` ask and a role's plain "awaiting operator"
    line are never closed here (a plain line only when it quotes the stamp's question outright)."""
    row = a.get("row")
    if not isinstance(row, str) or not row or row == "OPERATOR":
        return False
    qrows = state.get("rows") if isinstance(state.get("rows"), dict) else {}
    qrow = qrows.get(row) if isinstance(qrows.get(row), dict) else {}
    sup = state.get("supervise") if isinstance(state.get("supervise"), dict) else {}
    srows = sup.get("rows") if isinstance(sup.get("rows"), dict) else {}
    srow = srows.get(row) if isinstance(srows.get(row), dict) else {}
    lr = (ledger_rows or {}).get(row) if isinstance((ledger_rows or {}).get(row), dict) else {}
    moot = qrow.get("state") in ("merged", "dropped") or srow.get("stage") == "merged" or lr.get("outcome") == "merged"
    stamp_borne = bool(a.get("canonical_row") or a.get("stamp") or a.get("source") == "ledger")
    if moot and stamp_borne:
        return True
    answered = [d for d in (lr.get("decisions") or []) if isinstance(d, dict) and d.get("answered")]
    if not answered:
        return False
    anchor = a.get("stamp") or (a.get("ts") if a.get("source") == "ledger" else None)
    if anchor and any(d.get("at") == anchor for d in answered):
        return True
    if not (a.get("canonical_row") or a.get("thread_id")):
        return False
    head = MD_STRIP_RE.sub("", str(a.get("text") or a.get("head") or ""))
    ts = str(a.get("ts") or "")
    for d in answered:
        # the stamp's question, cut at the ANSWERED clause it may have absorbed (`…?; **ANSWERED …**`)
        question = ANSWERED_CLAUSE_RE.split(MD_STRIP_RE.sub("", str(d.get("text") or "")), maxsplit=1)[0]
        if _same_question(head, question):
            return True
        at = d.get("answered_at")
        if a.get("canonical_row") and isinstance(at, str) and at and ts and at >= ts:
            return True
    return False


def decision_lines(state: dict, ledger_rows: dict | None = None) -> list:
    """`DECISION NEEDED (<age>h): <row> — <head>` per standing operator ask (state.json `operator_asks`, or the
    supervisor's own copy under `supervise`), newest first, clipped to MAX_LINE, minus the asks the ledger / row state
    closed (ask_closed). [] when there are none."""
    state = state if isinstance(state, dict) else {}
    asks = state.get("operator_asks")
    if not isinstance(asks, list):
        sup = state.get("supervise") if isinstance(state.get("supervise"), dict) else {}
        asks = sup.get("operator_asks") if isinstance(sup.get("operator_asks"), list) else []
    out = []
    for a in sorted((a for a in asks if isinstance(a, dict) and a.get("row")), key=lambda a: str(a.get("ts") or ""), reverse=True):
        if ask_closed(a, state, ledger_rows):
            continue
        age = a.get("age_hours")
        age_s = str(int(age)) if isinstance(age, (int, float)) and not isinstance(age, bool) else "?"
        prefix = f"DECISION NEEDED ({age_s}h): {a['row']} — "
        head = " ".join(str(a.get("head") or a.get("text") or "").split()).replace("**", "").replace("`", "")
        out.append(prefix + trunc(head, max(NOTE_MIN, MAX_LINE - len(prefix))))
    return out


def table_line(v: dict) -> str:
    c = v["cells"]
    prefix = f"| {v['id']} | {v['batch']} | {c['a']} | {c['b']} | {c['t']} | {c['r']} | {c['gate']} | "
    budget = min(NOTE_MAX, max(NOTE_MIN, MAX_LINE - len(prefix) - 2))
    return prefix + trunc(v["note"], budget) + " |"


def render_abtr_markdown(state: dict, ledger_rows: dict, now: datetime, prs=(), alerts=(), config: dict | None = None, dispatchable=None,
                         cards_24h=None) -> str:
    rows = derive_rows(state, ledger_rows, now, prs, alerts, config)
    out = [header_line(state, rows, now, alerts, config, dispatchable, ledger_rows, cards_24h), *decision_lines(state, ledger_rows), *LEGEND, "", TABLE_HEADER, TABLE_RULE]
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
                      link: str = "/status/autopilot.md", cards_24h=None) -> str:
    """The tick's report: the header, one `<row> · <title> | a | b | t | r` line per in-flight row, the link. The
    title is the row's name clipped by short_title (2026-09-18, operator: the bare ids meant nothing in Slack); a row
    the state does not name prints as before."""
    rows = derive_rows(state, ledger_rows, now, prs, alerts, config)
    out = [header_line(state, rows, now, alerts, config, dispatchable, ledger_rows, cards_24h), *decision_lines(state, ledger_rows)]
    for v in rows:
        if v["group"] != "in_flight":
            continue
        c = v["cells"]
        head = f"{v['id']} · {v['title']}" if v.get("title") else v["id"]
        line = f"{head} | {c['a']} | {c['b']} | {c['t']} | {c['r']}"
        if c["gate"] != "·":
            line += f" | gate {c['gate']}"
        out.append(line)
    if not any(v["group"] == "in_flight" for v in rows):
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
