#!/usr/bin/env python3
"""Hermes port queue: dispatch-plan.md + gap-matrix.md + ledger.md -> one JSON state.

The dispatch tick (docs/hermes-port/autopilot.md §4) needs three answers every two
hours: which rows are in flight, how many WIP slots are free, and which rows fill them.
All three are set math over files the Orchestrator and the human already keep, and all
three were derived by hand at least once with a different answer each time. This module
is the deterministic core: pure functions over the file texts, one JSON out, no network,
no subprocess, no clock surprises (`--now` for tests).

Inputs (read, never edited):

  --plan    dispatch-plan.md  batch sections, 1b waves, adopt attachments, defer,
                              the `carries AC-<id>` bullets, the P8 owner table
  --matrix  gap-matrix.md     disposition / esc / outcomes / design_note per row
  --ledger  ledger.md         the Orchestrator's work list
                              (row-id | dispatched | spec accepted | PR | verdict |
                               merged/blocked | notes), columns located by header
  --config  config.json       wip, paused, paused_rows, waive, podman_box, plan_sha256,
                              matrix_sha256, authorize_round, install_tz_offset_minutes,
                              release_tag  (missing keys take DEFAULT_CONFIG)
  --state   state.json        the previous tick (optional): `dispatched` bookkeeping so a
                              row the dispatch cron sent but the ledger has not caught up
                              on is never dispatched twice, plus `signals` the supervise
                              tick derived from the role threads (tester_pass, merged)

Each `eligible_next` entry carries `dispatch_text` (the §4.4 text for the architect),
`orchestrator_text` (that text wrapped in the ledger-row + forward steps for the
Orchestrator; what dispatch-cron.sh POSTs on `thread_id`) and `thread_id` (hermes-<ID>).

Rules pinned here (each has a test in test_hermes_queue.py):

  * Row ids match `^[A-Z0-9]+-F[0-9]+(\\.[a-z])?$` whole-cell, so OPS-F58.a and
    SELF-F57.b are their own rows and P0-LOOP / P1-HELLO are `other_rows`. A decorated
    cell that names exactly one id (`LOOP-F35 (1a)`, `[LOOP-F35]`, a U+2011 hyphen) is
    read as that id and raises `ledger-id-spelling`: dropping it to `other_rows` would
    free its WIP slot and put the row back in `eligible_next`.
  * Ledger `merged/blocked`: the tokens `merged` (needs a sha or /pull/N within 60 chars)
    and `blocked:` are scanned anywhere in the cell; the last one in text order wins.
    `blocked: STOP` is terminal, `blocked: P<n>` is a gate rejection with rounds left.
  * WIP: in_flight = ledger rows that are neither merged nor blocked; free = wip - in_flight.
  * Order: 1a; then 1b (wave order), batch 2, adopt@P2, adopt@P3-waveA once 1a has a
    tester PASS; then batch 3 (needs podman_box), batch 4, adopt@P5 once batch 2 merged;
    then adopt@P6 once batches 3 and 4 merged. BUILD lane: a BUILD row jumps the queue
    when no BUILD row is in flight. DEFER and MERGE-> rows are never dispatched.
  * Never dispatch twice: a row with a ledger row, a `dispatched_at` in the previous
    state, or a `paused_rows` entry is not eligible.
  * A DEFER or MERGE-> id found in the ledger keeps its ledger state (it holds containers)
    and raises `plan-violation`; the human decides.

Output shape: see build_state().
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ID_RE = re.compile(r"^[A-Z0-9]+-F[0-9]+(?:\.[a-z])?$")
ID_TOKEN_RE = re.compile(r"\b[A-Z0-9]+-F[0-9]+(?:\.[a-z])?\b")
# Dashes a hand-edited id cell may carry between the family and F<NN> instead of `-`:
# U+2010 hyphen, U+2011 non-breaking hyphen, U+2012 figure dash, U+2013 en dash, U+2212 minus.
ID_DASH_RE = re.compile("(?<=[A-Z0-9])[\u2010\u2011\u2012\u2013\u2212](?=F[0-9])")
DISP_RE = re.compile(
    r"^(BUILD|CONFIGURE|ADOPT|DEFER|MERGE\s*(?:→|->)\s*([A-Z0-9]+-F[0-9]+(?:\.[a-z])?))$"
)
TS_RE = re.compile(
    r"(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?"
    r"\s*(Z|UTC|GMT|IST|CET|CEST|BST|EST|EDT|PST|PDT|[+-]\d{2}:?\d{2})?\b"
)
MERGED_RE = re.compile(r"(?i)\bmerged\b(?=.{0,60}?(?:\b[0-9a-f]{7,40}\b|/pull/\d+))")
BLOCKED_RE = re.compile(r"(?i)\bblocked:\s*(.*)")
VERDICT_TOKEN_RE = re.compile(r"\b(PASS|FAIL|APPROVE|REQUEST_CHANGES)\b")
TESTER_PASS_RES = (
    re.compile(r"(?i)(?:test\s+)?round\s+\d(?:/\d)?\s*(?:=|:|—|–|-)+\s*\**PASS\b"),
    re.compile(r"\[Test Report\][^|]*?\bPASS\b"),
    re.compile(r"\*\*Verdict:\*\*\s*PASS\b"),
    re.compile(r"\bAPPROVE\b"),
)
FAIL_ROUND2_RES = (
    re.compile(r"(?i)round\s+2/2\s*(?:=|:|—|–|-)+\s*\**FAIL\b"),
    re.compile(r"FAIL\s*[×x]\s*2"),
)

ZONES = {
    "Z": 0, "UTC": 0, "GMT": 0, "IST": 330, "CET": 60, "CEST": 120, "BST": 60,
    "EST": -300, "EDT": -240, "PST": -480, "PDT": -420,
}

DEFAULT_CONFIG = {
    "wip": 3,
    "paused": False,
    "paused_rows": [],
    "plan_sha256": None,
    "matrix_sha256": None,
    "podman_box": False,
    "waive": [],
    "core_change_ok": [],
    "authorize_round": {},
    "install_tz_offset_minutes": 330,  # the box's ledger stamps are IST unless a zone is named
    "release_tag": "v2026.8.31",
}

DISPATCH_BATCHES = ("1a", "1b", "2", "3", "4")
IN_FLIGHT_STATES = ("dispatched", "spec_handoff", "building", "pr_open", "testing", "review", "gate")
TERMINAL_STATES = ("merged", "blocked", "deferred", "carried")
ADOPT_PHASE_ORDER = ("P2", "P3-waveA", "P5-rooms-veto", "P6-fleet")
ONE_A_ROW = "LOOP-F35"
BATCH0_ROW = "P0-LOOP"


# --------------------------------------------------------------------------- helpers

def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def split_cells(line: str) -> list[str]:
    """Split one markdown table line on unescaped pipes, dropping the outer empties."""
    parts = re.split(r"(?<!\\)\|", line.strip())
    if parts and parts[0].strip() == "":
        parts = parts[1:]
    if parts and parts[-1].strip() == "":
        parts = parts[:-1]
    return [p.replace("\\|", "|").strip() for p in parts]


def is_separator(cells: list[str]) -> bool:
    return bool(cells) and all(re.fullmatch(r":?-{3,}:?", c) for c in cells)


def clean_id(cell: str) -> str:
    return cell.strip().strip("*`").strip()


def ledger_row_id(cell: str) -> tuple[str, list[str]]:
    """The id a ledger `row-id` cell names, plus the id tokens found when it is not a bare id.

    Whole-cell `ID_RE` (bold and backticks stripped) is the rule. A hand-edited cell such as
    `LOOP-F35 (1a)`, `[LOOP-F35]`, `LOOP-F35` followed by a note, or `LOOP-F35` written with a
    U+2011 hyphen still names exactly one id; it is read as that id so the row keeps its WIP
    slot and is never re-dispatched (the caller raises `ledger-id-spelling`). Zero tokens is
    a non-matrix row (`P0-LOOP`); two or more is ambiguous and stays a non-matrix row, alerted.
    """
    rid = clean_id(cell)
    if ID_RE.match(rid):
        return rid, []
    tokens = list(dict.fromkeys(ID_TOKEN_RE.findall(ID_DASH_RE.sub("-", rid))))
    if len(tokens) == 1:
        return tokens[0], tokens
    return rid, tokens


def is_empty_cell(cell: str) -> bool:
    t = cell.strip().strip("*").strip()
    return t == "" or re.fullmatch(r"[-—–]+", t) is not None or t.lower().startswith("n/a")


def iso_utc(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_iso(s: str) -> datetime:
    """ISO-8601 with Z or offset; a naive value is UTC."""
    t = s.strip()
    if t.endswith(("Z", "z")):
        t = t[:-1] + "+00:00"
    m = re.match(r"^(.*T\d{2}:\d{2}:\d{2})\.(\d+)(.*)$", t)
    if m:  # clip sub-microsecond fractions, which fromisoformat rejects on 3.9/3.10
        t = f"{m.group(1)}.{m.group(2)[:6]}{m.group(3)}"
    dt = datetime.fromisoformat(t)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def first_timestamp(cell: str, tz_offset_minutes: int) -> str | None:
    """First `YYYY-MM-DD HH:MM[:SS] [zone]` in the cell, as ISO UTC; install TZ when no zone."""
    m = TS_RE.search(cell)
    if not m:
        return None
    day, hh, mm, ss, zone = m.groups()
    offset = tz_offset_minutes
    if zone:
        if zone in ZONES:
            offset = ZONES[zone]
        else:
            sign = -1 if zone[0] == "-" else 1
            digits = zone[1:].replace(":", "")
            offset = sign * (int(digits[:2]) * 60 + int(digits[2:]))
    dt = datetime.fromisoformat(f"{day}T{hh}:{mm}:{ss or '00'}")
    dt = dt.replace(tzinfo=timezone(timedelta(minutes=offset)))
    return iso_utc(dt)


# --------------------------------------------------------------------------- plan

def classify_heading(heading: str) -> str | None:
    m = re.match(r"Batch\s+(\w+)", heading)
    if m:
        return m.group(1)
    if heading.startswith("Adopt"):
        return "adopt"
    if heading.startswith("Defer"):
        return "defer"
    if heading.startswith("P8"):
        return "p8"
    return None


def parse_plan(text: str) -> dict:
    """Structural parse of dispatch-plan.md: rows per section, waves, adopt attachments,
    carries bullets, P8 owners. Returns {rows, order, carries, upstream_owners, problems}."""
    rows: dict[str, dict] = {}
    order: list[str] = []
    carries: dict[str, list[str]] = {}
    upstream_owners: list[str] = []
    problems: list[str] = []
    section = None
    wave = None
    attaches = None
    carrier = None
    header: list[str] | None = None

    for raw in text.splitlines():
        line = raw.rstrip()
        m = re.match(r"^##\s+(.*)", line)
        if m:
            section = classify_heading(m.group(1).strip())
            wave = attaches = carrier = header = None
            continue
        if section is None:
            continue
        m = re.match(r"^\*\*Wave (\d+)\b", line)
        if m:
            wave = int(m.group(1))
            header = None
            continue
        m = re.match(r"^\*\*Attaches to ([^*]+)\*\*", line)
        if m:
            attaches = m.group(1).strip()
            header = None
            continue
        m = re.match(r"^Carried by \*\*([A-Z0-9]+-F[0-9]+(?:\.[a-z])?)\*\*", line)
        if m:
            carrier = m.group(1)
            continue
        m = re.match(r"^-\s+\*\*carries AC-([A-Z0-9]+-F[0-9]+(?:\.[a-z])?)\*\*", line)
        if m:
            if carrier:
                carries.setdefault(carrier, []).append(m.group(1))
            else:
                problems.append(f"carries bullet for {m.group(1)} without a 'Carried by' line")
            continue
        if not line.startswith("|"):
            continue
        cells = split_cells(line)
        if not cells or is_separator(cells):
            continue
        if header is None:
            header = [c.lower() for c in cells]
            continue
        if section == "p8":
            idx = header.index("owner row") if "owner row" in header else len(cells) - 1
            if idx < len(cells):
                found = ID_TOKEN_RE.search(cells[idx])
                if found and found.group(0) not in upstream_owners:
                    upstream_owners.append(found.group(0))
            continue
        rid = clean_id(cells[0])
        if not ID_RE.match(rid):
            continue
        if section not in DISPATCH_BATCHES + ("adopt", "defer"):
            continue
        row = {"batch": section, "name": cells[1] if len(cells) > 1 else ""}
        if section == "1b":
            row["wave"] = wave
        if section == "adopt":
            row["attaches_to"] = attaches
        if "disp" in header and header.index("disp") < len(cells):
            row["plan_disposition"] = clean_id(cells[header.index("disp")])
        if rid in rows:
            problems.append(f"{rid} listed twice in the plan ({rows[rid]['batch']}, {section})")
            continue
        rows[rid] = row
        order.append(rid)

    return {
        "rows": rows,
        "order": order,
        "carries": carries,
        "upstream_owners": upstream_owners,
        "problems": problems,
    }


# --------------------------------------------------------------------------- matrix

def parse_matrix(text: str) -> dict:
    """gap-matrix.md rows keyed by id. The name column carries raw pipes in a few rows,
    so columns are anchored on the disposition cell (an enum) rather than on position."""
    rows: dict[str, dict] = {}
    order: list[str] = []
    problems: list[str] = []
    header = None
    for line in text.splitlines():
        if not line.startswith("|"):
            continue
        cells = split_cells(line)
        if not cells or is_separator(cells):
            continue
        if header is None:
            if "id" in [c.lower() for c in cells]:
                header = [c.lower() for c in cells]
            continue
        rid = clean_id(cells[0])
        if not ID_RE.match(rid):
            continue
        d_idx = None
        for i, c in enumerate(cells):
            if i > 0 and DISP_RE.match(clean_id(c)):
                d_idx = i
                break
        if d_idx is None:
            problems.append(f"{rid}: no disposition cell")
            continue
        m = DISP_RE.match(clean_id(cells[d_idx]))
        merge_into = m.group(2)
        disposition = "MERGE" if merge_into else m.group(1)
        esc = clean_id(cells[d_idx - 1]) if d_idx >= 1 else ""
        outcomes_raw = cells[d_idx + 1] if len(cells) > d_idx + 1 else ""
        outcomes = (
            []
            if outcomes_raw.strip().lower() in ("", "none")
            else [o.strip() for o in outcomes_raw.split(",") if o.strip()]
        )
        if rid in rows:
            problems.append(f"{rid} listed twice in the matrix")
            continue
        rows[rid] = {
            "name": "|".join(cells[1 : max(1, d_idx - 3)]) if d_idx > 4 else cells[1],
            "status": cells[d_idx - 3] if d_idx >= 3 else "",
            "feas": cells[d_idx - 2] if d_idx >= 2 else "",
            "esc": esc.upper() == "Y",
            "disposition": disposition,
            "merge_into": merge_into,
            "outcomes": outcomes,
            "design_note": "|".join(cells[d_idx + 2 :]),
        }
        order.append(rid)
    return {"rows": rows, "order": order, "problems": problems}


# --------------------------------------------------------------------------- ledger

def parse_verdict_cell(cell: str) -> dict:
    tokens = VERDICT_TOKEN_RE.findall(cell)
    rounds = [int(r) for r in re.findall(r"(?i)\bround\s+(\d)", cell)]
    return {
        "tokens": tokens,
        "last_token": tokens[-1] if tokens else None,
        "rounds": rounds,
        "tester_pass": any(r.search(cell) for r in TESTER_PASS_RES),
        "fail_round2": any(r.search(cell) for r in FAIL_ROUND2_RES),
        "round3": re.search(r"(?i)\bround\s+3", cell) is not None,
    }


def parse_outcome_cell(cell: str) -> dict:
    """§2.2: token scan anywhere in the cell, last token in text order wins."""
    events: list[tuple[int, str, str]] = []
    for m in MERGED_RE.finditer(cell):
        events.append((m.start(), "merged", cell[m.end() : m.end() + 60]))
    for m in BLOCKED_RE.finditer(cell):
        events.append((m.start(), "blocked", m.group(1).strip()))
    if not events:
        return {"outcome": None, "reason": None, "gate_red": None, "merge_sha": None, "pr_url": None}
    _, kind, detail = max(events, key=lambda e: e[0])
    if kind == "merged":
        sha = re.search(r"\b[0-9a-f]{7,40}\b", detail)
        url = re.search(r"https?://\S*?/pull/\d+", cell)
        return {
            "outcome": "merged",
            "reason": None,
            "gate_red": None,
            "merge_sha": sha.group(0) if sha else None,
            "pr_url": url.group(0) if url else None,
        }
    reason = re.sub(r"\s+", " ", detail).strip()
    if re.match(r"STOP\b", reason):
        return {"outcome": "blocked", "reason": reason, "gate_red": None, "merge_sha": None, "pr_url": None}
    m = re.match(r"P(\d)\b", reason)
    if m:
        return {"outcome": "gate_red", "reason": reason, "gate_red": f"P{m.group(1)}", "merge_sha": None, "pr_url": None}
    return {"outcome": "blocked", "reason": reason, "gate_red": None, "merge_sha": None, "pr_url": None}


def parse_ledger(text: str, tz_offset_minutes: int = 330) -> dict:
    """The Orchestrator's work list. Columns are located from the header row, never by
    position; surplus cells (a raw pipe in `notes`) fold into the last column."""
    header = None
    col: dict[str, int] = {}
    rows: dict[str, dict] = {}
    other: dict[str, dict] = {}
    order: list[str] = []
    duplicates: list[str] = []
    spelling: list[dict] = []

    def cell(cells: list[str], name: str) -> str:
        i = col.get(name)
        return cells[i] if i is not None and i < len(cells) else ""

    for line in text.splitlines():
        if not line.startswith("|"):
            continue
        cells = split_cells(line)
        if not cells or is_separator(cells):
            continue
        low = [c.lower() for c in cells]
        if header is None:
            if any(h in low for h in ("row-id", "req-id", "id")):
                header = low
                col = {name: i for i, name in enumerate(header)}
            continue
        if len(cells) > len(header):
            cells = cells[: len(header) - 1] + ["|".join(cells[len(header) - 1 :])]
        id_col = next((col[h] for h in ("row-id", "req-id", "id") if h in col), 0)
        raw_id = clean_id(cells[id_col]) if id_col < len(cells) else ""
        rid, id_tokens = ledger_row_id(raw_id)
        if not rid:
            continue
        dispatched = cell(cells, "dispatched")
        spec = cell(cells, "spec accepted")
        pr_cell = cell(cells, "pr")
        pr = re.search(r"#(\d+)", pr_cell)
        entry = {
            "dispatched": not is_empty_cell(dispatched),
            "dispatched_at": first_timestamp(dispatched, tz_offset_minutes) if not is_empty_cell(dispatched) else None,
            "spec_accepted": not is_empty_cell(spec),
            "spec_accepted_at": first_timestamp(spec, tz_offset_minutes) if not is_empty_cell(spec) else None,
            "pr": int(pr.group(1)) if pr and not is_empty_cell(pr_cell) else None,
            "pr_draft": "draft" in pr_cell.lower(),
            "verdict": parse_verdict_cell(cell(cells, "verdict")),
            "notes_len": len(cell(cells, "notes")),
        }
        entry.update(parse_outcome_cell(cell(cells, "merged/blocked")))
        if not ID_RE.match(rid):
            if len(id_tokens) > 1:
                spelling.append({"row": None, "cell": raw_id, "ids": id_tokens})
            other[rid] = entry
            continue
        if rid != raw_id:
            entry["id_cell_raw"] = raw_id
            spelling.append({"row": rid, "cell": raw_id, "ids": id_tokens})
        if rid in rows:
            duplicates.append(rid)
        else:
            order.append(rid)
        rows[rid] = entry  # last wins (§2.2)
    return {
        "header_ok": header is not None,
        "rows": rows,
        "order": order,
        "other_rows": other,
        "duplicates": duplicates,
        "spelling": spelling,
    }


def ledger_state(entry: dict, round3_authorized: bool = False) -> tuple[str, str | None]:
    """Coarse row state from the ledger alone (source A). The supervise tick refines it
    with the role threads and the fork; the dispatch tick only needs terminal-or-not."""
    if entry["outcome"] == "merged":
        return "merged", None
    if entry["outcome"] == "blocked":
        return "blocked", entry["reason"]
    v = entry["verdict"]
    if v["fail_round2"] and not v["round3"] and not round3_authorized:
        return "blocked", "cap: test FAIL x2 (verdict cell), no round 3 authorized"
    if entry["pr"]:
        if entry["outcome"] == "gate_red":
            return "building", None
        last = v["last_token"]
        if last == "APPROVE":
            return "gate", None
        if last == "PASS":
            return "review", None
        if last in ("FAIL", "REQUEST_CHANGES"):
            return "building", None
        return "pr_open", None
    if entry["spec_accepted"]:
        return "spec_handoff", None
    return "dispatched", None


# --------------------------------------------------------------------------- coverage

def coverage_check(plan: dict, matrix: dict) -> dict:
    """§4: the parse must reproduce the plan's coverage (every matrix id exactly once
    across batches / adopt / defer / merge, dispositions agreeing) or dispatch pauses."""
    problems = list(plan["problems"]) + list(matrix["problems"])
    counts = {b: 0 for b in DISPATCH_BATCHES}
    counts.update({"adopt": 0, "defer": 0, "merge": 0})
    seen = set()
    for rid, prow in plan["rows"].items():
        seen.add(rid)
        counts[prow["batch"]] += 1
        mrow = matrix["rows"].get(rid)
        if mrow is None:
            problems.append(f"{rid}: in the plan, not in the matrix")
            continue
        want = {"adopt": ("ADOPT",), "defer": ("DEFER",)}.get(prow["batch"], ("BUILD", "CONFIGURE"))
        if mrow["disposition"] not in want:
            problems.append(f"{rid}: plan batch {prow['batch']} vs matrix disposition {mrow['disposition']}")
        pd = prow.get("plan_disposition")
        if pd and pd != mrow["disposition"]:
            problems.append(f"{rid}: plan Disp {pd} vs matrix {mrow['disposition']}")
    for rid, mrow in matrix["rows"].items():
        if mrow["disposition"] == "MERGE":
            counts["merge"] += 1
            if rid in seen:
                problems.append(f"{rid}: MERGE->{mrow['merge_into']} but also listed in the plan")
            seen.add(rid)
            if mrow["merge_into"] not in matrix["rows"]:
                problems.append(f"{rid}: MERGE target {mrow['merge_into']} not in the matrix")
            elif matrix["rows"][mrow["merge_into"]]["disposition"] not in ("BUILD", "CONFIGURE"):
                problems.append(f"{rid}: MERGE target {mrow['merge_into']} is not a dispatched row")
        elif rid not in seen:
            problems.append(f"{rid}: {mrow['disposition']} in the matrix, missing from the plan")
    for carrier, ids in plan["carries"].items():
        for cid in ids:
            mrow = matrix["rows"].get(cid)
            if mrow is None or mrow["disposition"] != "MERGE" or mrow["merge_into"] != carrier:
                problems.append(f"{carrier} carries {cid} but the matrix does not say MERGE->{carrier}")
    dispatched = sum(counts[b] for b in DISPATCH_BATCHES)
    total = dispatched + counts["adopt"] + counts["defer"] + counts["merge"]
    if total != len(matrix["rows"]):
        problems.append(f"coverage {total} != {len(matrix['rows'])} matrix rows")
    return {
        "ok": not problems,
        "problems": problems,
        "dispatched": dispatched,
        "by_batch": {b: counts[b] for b in DISPATCH_BATCHES},
        "adopt": counts["adopt"],
        "merge": counts["merge"],
        "defer": counts["defer"],
        "total": total,
        "matrix_rows": len(matrix["rows"]),
    }


# --------------------------------------------------------------------------- state

def load_config(raw: dict | None) -> dict:
    cfg = dict(DEFAULT_CONFIG)
    for k, v in (raw or {}).items():
        cfg[k] = v
    cfg["paused_rows"] = list(cfg.get("paused_rows") or [])
    cfg["waive"] = list(cfg.get("waive") or [])
    cfg["authorize_round"] = dict(cfg.get("authorize_round") or {})
    try:
        cfg["wip"] = max(0, int(cfg["wip"]))
    except (TypeError, ValueError):
        cfg["wip"] = DEFAULT_CONFIG["wip"]
    return cfg


def _all_merged(ids: list[str], rows: dict, waive: list[str]) -> bool:
    return bool(ids) and all(rows[i]["state"] == "merged" or i in waive for i in ids)


def compute_gating(rows: dict, plan: dict, ledger: dict, cfg: dict, signals: dict) -> dict:
    by_batch: dict[str, list[str]] = {}
    for rid in plan["order"]:
        by_batch.setdefault(plan["rows"][rid]["batch"], []).append(rid)
    one_a = by_batch.get("1a", [])
    waive = cfg["waive"]
    one_a_merged = _all_merged(one_a, rows, waive)
    tester_pass = set(signals.get("tester_pass") or [])
    first_pass = one_a_merged or any(
        rid in tester_pass
        or rows[rid]["ledger"] is not None
        and (rows[rid]["ledger"]["verdict"]["tester_pass"] or rows[rid]["state"] in ("review", "gate"))
        for rid in one_a
    )
    batch0 = ledger["other_rows"].get(BATCH0_ROW)
    return {
        "batch0_merged": bool(batch0 and batch0["outcome"] == "merged"),
        "1a_first_pass": first_pass,
        "1a_merged": one_a_merged,
        "1a_blocked": any(rows[i]["state"] == "blocked" for i in one_a),
        "batch2_merged": _all_merged(by_batch.get("2", []), rows, waive),
        "batch3_merged": _all_merged(by_batch.get("3", []), rows, waive),
        "batch4_merged": _all_merged(by_batch.get("4", []), rows, waive),
        "podman_box": bool(cfg["podman_box"]),
        "paused": bool(cfg["paused"]),
        "waived": list(waive),
    }


def dispatch_order(plan: dict, matrix: dict) -> list[tuple[str, tuple[str, ...]]]:
    """Every dispatchable row in §4.2 order with the gates it waits on."""
    by_batch: dict[str, list[str]] = {}
    for rid in plan["order"]:
        by_batch.setdefault(plan["rows"][rid]["batch"], []).append(rid)
    adopt = by_batch.get("adopt", [])

    def adopt_at(phase: str) -> list[str]:
        return [r for r in adopt if (plan["rows"][r].get("attaches_to") or "") == phase]

    known = set()
    for ph in ADOPT_PHASE_ORDER:
        known.update(adopt_at(ph))
    adopt_unplaced = [r for r in adopt if r not in known]
    one_b = sorted(by_batch.get("1b", []), key=lambda r: (plan["rows"][r].get("wave") or 99, plan["order"].index(r)))

    order: list[tuple[str, tuple[str, ...]]] = []
    order += [(r, ()) for r in by_batch.get("1a", [])]
    tier2 = one_b + by_batch.get("2", []) + adopt_at("P2") + adopt_at("P3-waveA") + adopt_unplaced
    order += [(r, ("1a_first_pass",)) for r in tier2]
    order += [(r, ("batch2_merged", "podman_box")) for r in by_batch.get("3", [])]
    order += [(r, ("batch2_merged",)) for r in by_batch.get("4", []) + adopt_at("P5-rooms-veto")]
    order += [(r, ("batch3_merged", "batch4_merged")) for r in adopt_at("P6-fleet")]
    return order


def dispatch_text(rid: str, row: dict, cfg: dict) -> str:
    """§4.4 templates, filled for one row."""
    name = row["name"]
    batch = row["batch"]
    if row["disposition"] == "ADOPT":
        text = (
            f"Adopt {rid}: {name}.\n\n"
            f"Adopt-track row (dispatch-plan.md § Adopt, attaches to {row.get('attaches_to') or 'n/a'}): "
            "Hermes already provides this. Deliverable: ONE doc page under website/docs/ mapping the "
            "NanoClaw behaviour onto the Hermes feature, citing the Hermes file (path + function or config "
            f"key) in the tag:/main: form of gap-matrix-evidence.md § {rid}, plus ONE hermetic acceptance "
            "test proving Hermes does it. No plugin. ADR is the doc page's outline plus a ## Acceptance "
            f"criteria table with pytest: rows only. Same chain, same draft PR shape (title suffix [{rid}]), "
            "same merge gate."
        )
    else:
        carries = ", ".join(f"AC-{c}" for c in row.get("carries") or []) or "none"
        text = (
            f"Dispatch {rid}: {name}.\n\n"
            f"Requirement row: /workspace/shared/hermes/gap-matrix.md (row {rid}; disposition "
            f"{row['disposition']}); evidence: /workspace/shared/hermes/gap-matrix-evidence.md (section {rid}); "
            f"baseline: topology.md; plan: /workspace/shared/hermes/dispatch-plan.md (batch {batch}). Cite the "
            "pinned release tree; author plugin code against the MAIN module paths named in the evidence.\n"
            f"The ADR must cover this row AND every id it carries: {carries}.\n\n"
            "Deliver the ADR + acceptance test (kinds pytest: / ui: / desktop: / live:) as the gated "
            "[Spec handoff] on this thread, then forward to hermes-builder. Draft PR on "
            f"slang-coworkers/hermes-agent, base release/{cfg['release_tag']}-e2e-fixed, title suffix [{rid}]. "
            "Round caps: 2 in-plugin test FAILs per review cycle, 2 review rounds per PR; FAIL (env) and ESCALATE never count."
        )
    if row.get("upstream_ask") and row["disposition"] == "ADOPT":
        text += (
            "\n\nUpstream ask: this row also owns a P8 ask (plan § P8, or esc = Y in the matrix). Record what "
            "Hermes lacks in the ADR's ## CORE-CHANGE section with the release-tree citation; the Orchestrator "
            "files it as an upstream ask (plan decision 2). Still no plugin, and no fork patch outside "
            "website/docs/** and tests/**."
        )
    elif row.get("upstream_ask"):
        text += (
            "\n\nUpstream ask: this row is plugin-only. Anything the plugin surface cannot do goes in the "
            "ADR's ## CORE-CHANGE section with the release-tree citation; the Orchestrator files it as an "
            "upstream ask (plan decision 2). No fork patch outside plugins/** without that citation."
        )
    return text


def orchestrator_text(rid: str, row: dict, architect_text: str) -> str:
    """The message the dispatch cron POSTs to the Orchestrator on thread hermes-<ID>.

    `dispatch_text` is written to the architect. The cron cannot reach the architect: it POSTs to
    the dashboard chat API, which is the Orchestrator's inbox on the row's own thread (the reason
    the dispatch tick is a host cron and not a task series: replies home to the thread they were
    sent on). So the Orchestrator gets the same three steps the hand path (dispatch-rows.sh) and
    the old dispatch prompt gave it, with the architect text to forward verbatim underneath.
    """
    carries = ", ".join(f"AC-{c}" for c in row.get("carries") or []) or "none"
    return (
        f"Autopilot dispatch {rid} ({row['disposition']}, batch {row['batch']}): {row['name']}.\n\n"
        "You are the Orchestrator; this thread is the row's dashboard thread. Do, in this order:\n"
        f"1. Re-check: if /workspace/agent/reports/ledger.md already has a row whose row-id cell names {rid}, "
        "reply \"already dispatched\" on this thread and stop.\n"
        "2. Append the ledger row (columns row-id | dispatched | spec accepted | PR | verdict | merged/blocked | "
        "notes; the lone dash for the empty cells; never a second row for an id; edit nothing else):\n"
        f"   | {rid} | <stamp> (to hermes-architect, thread `hermes-{rid}`) | \u2014 | \u2014 | \u2014 | \u2014 | "
        f"autopilot dispatch, batch {row['batch']}, {row['disposition']}; {row['name']}; carries {carries} |\n"
        "   <stamp> = date '+%Y-%m-%d %H:%M %Z'.\n"
        "3. Send the text below the dashed line VERBATIM to hermes-architect as an unmarked fresh message on "
        f"this thread: send_message(to=\"hermes-architect\", thread_id=\"hermes-{rid}\", text=<that text>). "
        "Then end the turn.\n"
        "Merge only through the merge gate (P1-P6). Reply on this thread only with the outcome line when the "
        "row is merged or blocked.\n\n----\n"
        + architect_text
    )


def build_state(
    plan_text: str,
    matrix_text: str,
    ledger_text: str,
    config: dict | None = None,
    prior_state: dict | None = None,
    now: str | None = None,
) -> dict:
    cfg = load_config(config)
    prior = prior_state or {}
    signals = prior.get("signals") or {}
    now_dt = parse_iso(now) if now else datetime.now(timezone.utc)

    plan = parse_plan(plan_text)
    matrix = parse_matrix(matrix_text)
    ledger = parse_ledger(ledger_text, cfg["install_tz_offset_minutes"])
    coverage = coverage_check(plan, matrix)
    alerts: list[dict] = []

    plan_sha = sha256_text(plan_text)
    matrix_sha = sha256_text(matrix_text)
    plan_ok = coverage["ok"]
    if cfg["plan_sha256"] and cfg["plan_sha256"] != plan_sha:
        plan_ok = False
        alerts.append({"kind": "plan-changed", "row": None, "detail": f"dispatch-plan.md sha256 {plan_sha[:12]} != config {str(cfg['plan_sha256'])[:12]}"})
    if cfg["matrix_sha256"] and cfg["matrix_sha256"] != matrix_sha:
        plan_ok = False
        alerts.append({"kind": "plan-changed", "row": None, "detail": f"gap-matrix.md sha256 {matrix_sha[:12]} != config {str(cfg['matrix_sha256'])[:12]}"})
    if not coverage["ok"]:
        alerts.append({"kind": "plan-changed", "row": None, "detail": "coverage check failed: " + "; ".join(coverage["problems"][:5])})
    if not ledger["header_ok"]:
        alerts.append({"kind": "ledger-unreadable", "row": None, "detail": "no header row with row-id found"})
    for rid in ledger["duplicates"]:
        alerts.append({"kind": "ledger-duplicate", "row": rid, "detail": "two ledger rows for one id; last used"})
    for s in ledger["spelling"]:
        if s["row"] is None:
            alerts.append({"kind": "ledger-id-spelling", "row": None, "detail": f"row-id cell {s['cell']!r} names {len(s['ids'])} ids ({', '.join(s['ids'])}); row not counted; make the cell one bare id"})
        else:
            alerts.append({"kind": "ledger-id-spelling", "row": s["row"], "detail": f"row-id cell {s['cell']!r} read as {s['row']}; make the cell the bare id"})

    prior_rows = prior.get("rows") or {}
    carried_by = {cid: carrier for carrier, ids in plan["carries"].items() for cid in ids}
    rows: dict[str, dict] = {}
    for rid in matrix["order"]:
        mrow = matrix["rows"][rid]
        prow = plan["rows"].get(rid, {})
        disposition = mrow["disposition"]
        batch = prow.get("batch") or {"MERGE": "merge", "DEFER": "defer"}.get(disposition, "unplanned")
        row: dict = {
            "batch": batch,
            "disposition": disposition,
            "name": prow.get("name") or mrow["name"],
            "esc": mrow["esc"],
            "upstream_ask": mrow["esc"] or rid in plan["upstream_owners"],
            "outcomes": mrow["outcomes"],
            "design_note": mrow["design_note"],
            "carries": plan["carries"].get(rid, []),
            "state": "queued",
            "state_reason": None,
            "ledger": None,
        }
        if disposition == "MERGE":
            row["merge_into"] = mrow["merge_into"]
            row["state"] = "carried"
        if disposition == "DEFER":
            row["state"] = "deferred"
        if rid in carried_by and disposition != "MERGE":
            row["carried_by_plan"] = carried_by[rid]
        if "wave" in prow:
            row["wave"] = prow["wave"]
        if "attaches_to" in prow:
            row["attaches_to"] = prow["attaches_to"]

        entry = ledger["rows"].get(rid)
        if entry is not None:
            row["ledger"] = entry
            st, reason = ledger_state(entry, rid in cfg["authorize_round"])
            if disposition in ("MERGE", "DEFER"):
                alerts.append({"kind": "plan-violation", "row": rid, "detail": f"{disposition} row has a ledger row (state {st})"})
                row["plan_disposition_conflict"] = True
            if st == "merged" and rid in (signals.get("not_merged") or []):
                alerts.append({"kind": "ledger-drift", "row": rid, "detail": "ledger says merged, fork does not"})
            row["state"] = st
            row["state_reason"] = reason
            row["gate_red"] = entry["gate_red"]
        elif disposition in ("BUILD", "CONFIGURE", "ADOPT"):
            if rid in (signals.get("merged") or []):
                row["state"] = "merged"
                row["state_reason"] = "fork PR merged (thread/fork signal), ledger row missing"
                alerts.append({"kind": "ledger-drift", "row": rid, "detail": "fork says merged, ledger has no row"})
            elif (prior_rows.get(rid) or {}).get("dispatched_at"):
                row["state"] = "dispatched"
                row["state_reason"] = "dispatched per state.json bookkeeping; ledger row not seen yet"
                row["dispatched_at"] = prior_rows[rid]["dispatched_at"]
        if rid in cfg["paused_rows"]:
            row["paused"] = True
        rows[rid] = row

    for rid in ledger["order"]:
        if rid not in rows:
            alerts.append({"kind": "ledger-unknown-id", "row": rid, "detail": "ledger row id is not in the matrix"})

    # MERGE-> rows are satisfied when their target merges.
    for rid, row in rows.items():
        if row["disposition"] == "MERGE":
            target = rows.get(row.get("merge_into") or "")
            row["target_state"] = target["state"] if target else None
            if target and target["state"] == "merged":
                row["state"] = "merged"
                row["state_reason"] = f"carried by {row['merge_into']}, which merged"

    in_flight = [r for r in matrix["order"] if rows[r]["state"] in IN_FLIGHT_STATES]
    merged = [r for r in matrix["order"] if rows[r]["state"] == "merged" and rows[r]["disposition"] != "MERGE"]
    blocked = [r for r in matrix["order"] if rows[r]["state"] == "blocked"]
    gating = compute_gating(rows, plan, ledger, cfg, signals)
    free = max(0, cfg["wip"] - len(in_flight))
    build_in_flight = any(rows[r]["disposition"] == "BUILD" for r in in_flight)

    eligible: list[dict] = []
    waiting: list[dict] = []
    podman_needed = False
    for rid, gates in dispatch_order(plan, matrix):
        row = rows[rid]
        if row["state"] != "queued" or row.get("paused"):
            continue
        unmet = [g for g in gates if not gating.get(g)]
        label = f"batch {row['batch']}" + (f" wave {row['wave']}" if row.get("wave") else "") + (
            f" (adopt @ {row['attaches_to']})" if row.get("attaches_to") else ""
        )
        if unmet:
            if unmet == ["podman_box"]:
                podman_needed = True
            waiting.append({"id": rid, "batch": row["batch"], "blocked_by": unmet, "reason": f"{label}: waits for {', '.join(unmet)}"})
        else:
            reason = f"{label}: eligible" + (f" ({', '.join(gates)} satisfied)" if gates else " immediately")
            eligible.append({"id": rid, "batch": row["batch"], "disposition": row["disposition"], "reason": reason})

    if not build_in_flight:
        for i, e in enumerate(eligible):
            if e["disposition"] == "BUILD" and i > 0:
                eligible.insert(0, eligible.pop(i))
                eligible[0]["reason"] += "; BUILD lane: no BUILD row in flight"
                break
    if podman_needed:
        alerts.append({"kind": "podman-box-needed", "row": None, "detail": "batch 3 rows are otherwise eligible; config.podman_box is false"})

    dispatch_paused = None
    if gating["paused"]:
        dispatch_paused = "config.paused"
    elif not plan_ok:
        dispatch_paused = "plan-changed: hashes or coverage check"
    elif not ledger["header_ok"]:
        dispatch_paused = "ledger unreadable"
    eligible_next = [] if dispatch_paused else eligible[:free]
    for e in eligible_next:
        e["dispatch_text"] = dispatch_text(e["id"], rows[e["id"]], cfg)
        e["orchestrator_text"] = orchestrator_text(e["id"], rows[e["id"]], e["dispatch_text"])
        e["thread_id"] = f"hermes-{e['id']}"
        e["dashboard_line"] = f"Dispatched {e['id']} to hermes-architect (autopilot, batch {e['batch']})"

    return {
        "generated_at": iso_utc(now_dt),
        "plan_sha256": plan_sha,
        "matrix_sha256": matrix_sha,
        "ledger_sha256": sha256_text(ledger_text),
        "plan_ok": plan_ok,
        "coverage": coverage,
        "wip": {"limit": cfg["wip"], "in_flight": len(in_flight), "free": free, "build_in_flight": build_in_flight},
        "gating": gating,
        "dispatch_paused": dispatch_paused,
        "rows": rows,
        "in_flight": in_flight,
        "merged": merged,
        "blocked": blocked,
        "eligible_next": eligible_next,
        "next_queue": (eligible + waiting)[:3],
        "queue": {"eligible": [e["id"] for e in eligible], "waiting": waiting},
        "alerts": alerts,
        "sources": {
            "ledger": {
                "rows": len(ledger["rows"]),
                "other_rows": sorted(ledger["other_rows"]),
                "duplicates": ledger["duplicates"],
                "id_spelling": ledger["spelling"],
                "header_ok": ledger["header_ok"],
            },
            "plan": {"rows": len(plan["rows"]), "upstream_owners": plan["upstream_owners"], "problems": plan["problems"]},
            "matrix": {"rows": len(matrix["rows"]), "problems": matrix["problems"]},
        },
    }


# --------------------------------------------------------------------------- cli

def _read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def _read_json(path: str | None) -> dict | None:
    if not path:
        return None
    p = Path(path)
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8") or "{}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="hermes_queue.py",
        description="Hermes port dispatch queue: plan + matrix + ledger -> JSON state (autopilot.md §4).",
    )
    ap.add_argument("--plan", required=True, help="dispatch-plan.md")
    ap.add_argument("--matrix", required=True, help="gap-matrix.md")
    ap.add_argument("--ledger", required=True, help="the Orchestrator's ledger.md")
    ap.add_argument("--config", help="config.json (wip, paused, paused_rows, waive, podman_box, hashes)")
    ap.add_argument("--state", help="previous state.json (dispatched bookkeeping, supervise signals)")
    ap.add_argument("--now", help="ISO timestamp for generated_at (tests)")
    ap.add_argument("--json", action="store_true", help="compact JSON on one line (default: indented)")
    args = ap.parse_args(argv)

    try:
        ledger_text = _read(args.ledger)
    except OSError as e:
        ledger_text = ""
        print(f"ledger unreadable: {e}", file=sys.stderr)
    state = build_state(
        _read(args.plan),
        _read(args.matrix),
        ledger_text,
        config=_read_json(args.config),
        prior_state=_read_json(args.state),
        now=args.now,
    )
    if args.json:
        print(json.dumps(state, separators=(",", ":"), sort_keys=True))
    else:
        print(json.dumps(state, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
