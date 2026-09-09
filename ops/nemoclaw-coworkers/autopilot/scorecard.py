#!/usr/bin/env python3
"""scorecard.py: the human's 6-hourly Hermes autopilot scorecard, rendered from
files hermes-check.sh pulled off the box. Read-only, stdlib, exit 0 always.

  scorecard.py --dir /tmp/hermes-check [--now ISO] [--plan-sha256 HEX] [--plan PATH]

Inputs in --dir (each optional; a missing one is reported, never fatal):
  ledger.md    groups/orchestrator/reports/ledger.md (the one ledger)
  alerts.md    groups/orchestrator/reports/status/alerts.md (newest first)
  state.json   data/shared/hermes/autopilot/state.json (last tick)
  config.json  data/shared/hermes/autopilot/config.json (wip, paused, plan_sha256)
  prs.json     gh pr list --repo slang-coworkers/hermes-agent --state all --json ...
Each has a path override (--ledger, --alerts, --state, --config, --prs) for the container,
where the three live in different directories.

  --markdown [PATH]   the a | b | t | r report (abtr.py): one line per row, roles as cells,
                      printed and, with PATH, written atomically (the tick writes
                      /workspace/agent/reports/status/autopilot.md = viewer /status/autopilot.md)
  --brief [PATH]      the tick's report: the markdown's header line plus one
                      `<row> | a | b | t | r` line per in-flight row and the link to the table

The ledger is parsed the way hermes-status-report does it: columns located
from the header row, ids matched whole-cell with [A-Z0-9]+-F[0-9]+(.[a-z])?,
outcome by an anywhere-in-cell token scan (`merged` followed within 60 chars
by a sha or /pull/N, `blocked:`; the last token wins). state.json, when
present and fresh, is the authority for per-row stage, SLO and actions; the
ledger read is the fallback and the cross-check.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone

try:
    import abtr
except ImportError:  # the mirror on the box may lag one file; the text scorecard still renders
    abtr = None

ROW_ID_RE = re.compile(r"^[A-Z0-9]+-F[0-9]+(\.[a-z])?$")
ID_TOKEN_RE = re.compile(r"\b[A-Z0-9]+-F[0-9]+(?:\.[a-z])?\b")
ID_DASH_RE = re.compile("(?<=[A-Z0-9])[\u2010\u2011\u2012\u2013\u2212](?=F[0-9])")  # hyphen look-alikes
MERGED_RE = re.compile(r"merged.{0,60}?(?:\b[0-9a-f]{7,40}\b|/pull/\d+)", re.IGNORECASE | re.DOTALL)
BLOCKED_RE = re.compile(r"blocked:", re.IGNORECASE)
STAMP_RE = re.compile(r"(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})")
PR_RE = re.compile(r"#(\d+)")
ALERT_RE = re.compile(r"^- (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z?)\s+·\s+(\S+)\s+·\s+(.*)$")
LONE_DASH = {"", "-", "—", "–", "n/a", "na", "none"}
DEFAULT_DISPATCHABLE = 30
TICK_STALE_H = 3.0
ALERT_WINDOW_H = 6.0
TZ_OFFSETS = {"IST": timedelta(hours=5, minutes=30), "UTC": timedelta(0), "Z": timedelta(0)}


def parse_iso(value):
    if not value or not isinstance(value, str):
        return None
    v = value.strip()
    if v.endswith("Z"):
        v = v[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(v)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def parse_stamp(cell: str, default_offset: timedelta):
    """First `YYYY-MM-DD HH:MM` in a ledger cell, zone from a named token, else the install default."""
    m = STAMP_RE.search(cell or "")
    if not m:
        return None
    offset = default_offset
    for tok, off in TZ_OFFSETS.items():
        if re.search(rf"\b{tok}\b", cell):
            offset = off
            break
    wall = datetime.strptime(f"{m.group(1)} {m.group(2)} +0000", "%Y-%m-%d %H:%M %z")
    return wall - offset


def hours_between(later, earlier):
    if later is None or earlier is None:
        return None
    return round((later - earlier).total_seconds() / 3600.0, 1)


def split_row(line: str) -> list:
    line = line.strip().removeprefix("|").removesuffix("|")
    return [c.replace("\x00", "\\|").strip() for c in line.replace("\\|", "\x00").split("|")]


def is_empty_cell(cell: str) -> bool:
    return (cell or "").strip().strip("*`").lower() in LONE_DASH


def cell_of(cells: list, cols: dict, name: str) -> str:
    i = cols.get(name)
    return cells[i] if i is not None and i < len(cells) else ""


def parse_ledger(text: str, default_offset: timedelta) -> dict:
    """Return {"rows": {ID: {...}}, "other_rows": [...], "duplicates": [...], "spelling": [...], "header_found": bool}."""
    rows: dict = {}
    other: list = []
    dups: list = []
    spelling: list = []
    cols: dict = {}
    header_found = False
    for line in text.splitlines():
        if not line.lstrip().startswith("|"):
            continue
        cells = split_row(line)
        if not header_found:
            lowered = [c.lower() for c in cells]
            if "row-id" in lowered and "merged/blocked" in lowered:
                cols = {name: i for i, name in enumerate(lowered)}
                header_found = True
            continue
        if all(set(c) <= set("-: ") for c in cells):
            continue
        raw_id = cells[cols["row-id"]] if cols["row-id"] < len(cells) else ""
        raw_id = raw_id.strip("*` ")
        rid = raw_id
        if not ROW_ID_RE.match(rid):
            # Same reading as hermes_queue.ledger_row_id: a decorated cell naming exactly one id
            # (`LOOP-F35 (1a)`, `[LOOP-F35]`, a U+2011 hyphen) is that row, not a non-matrix row.
            tokens = list(dict.fromkeys(ID_TOKEN_RE.findall(ID_DASH_RE.sub("-", rid))))
            if len(tokens) != 1:
                if rid:
                    other.append(rid)
                continue
            rid = tokens[0]
            spelling.append({"row": rid, "cell": raw_id})

        def cell(name, cells=cells, cols=cols):
            return cell_of(cells, cols, name)

        outcome_cell = cell("merged/blocked")
        outcome = "in_flight"
        last_pos = -1
        for m in MERGED_RE.finditer(outcome_cell):
            if m.start() > last_pos:
                last_pos, outcome = m.start(), "merged"
        for m in BLOCKED_RE.finditer(outcome_cell):
            if m.start() > last_pos:
                last_pos, outcome = m.start(), "blocked"
        pr = None
        pm = PR_RE.search(cell("pr"))
        if pm:
            pr = int(pm.group(1))
        dispatched_at = parse_stamp(cell("dispatched"), default_offset)
        spec_at = None if is_empty_cell(cell("spec accepted")) else parse_stamp(cell("spec accepted"), default_offset)
        if outcome == "in_flight":
            if pr:
                stage = "pr_open"
            elif not is_empty_cell(cell("spec accepted")):
                stage = "spec_handoff"
            else:
                stage = "dispatched"
        else:
            stage = outcome
        verdict = cell("verdict")
        if rid in rows:
            dups.append(rid)
        rows[rid] = {
            "outcome": outcome,
            "stage": stage,
            "pr": pr,
            "dispatched_at": dispatched_at.isoformat().replace("+00:00", "Z") if dispatched_at else None,
            "spec_accepted_at": spec_at.isoformat().replace("+00:00", "Z") if spec_at else None,
            "verdict": verdict if not is_empty_cell(verdict) else "",
            "outcome_cell": outcome_cell[:120],
            "notes": " ".join(cell("notes").split())[:240],
        }
        if rid != raw_id:
            rows[rid]["id_cell_raw"] = raw_id
    return {"rows": rows, "other_rows": other, "duplicates": dups, "spelling": spelling, "header_found": header_found}


def parse_alerts(text: str) -> list:
    out = []
    for line in text.splitlines():
        m = ALERT_RE.match(line.strip())
        if m:
            out.append({"at": m.group(1), "row": m.group(2), "rest": m.group(3), "line": line.strip()})
    return out


def load_json(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh), None
    except FileNotFoundError:
        return None, "missing"
    except (OSError, ValueError) as exc:
        return None, f"unreadable: {exc}"


def load_text(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return fh.read(), None
    except FileNotFoundError:
        return None, "missing"
    except OSError as exc:
        return None, f"unreadable: {exc}"


def dispatchable_from_plan(path):
    text, err = load_text(path) if path else (None, "no plan path")
    if text is None:
        return DEFAULT_DISPATCHABLE, err
    m = re.search(r"(\d+) dispatched \(batch", text)
    return (int(m.group(1)), None) if m else (DEFAULT_DISPATCHABLE, "coverage line not found")


def row_state_from_state(st: dict, rid: str):
    """One normalised view {state, since, age_h, slo, last_activity, hold, cost_hold, pr} of a row.

    Prefers the supervisor's row (state.json["supervise"]["rows"], keys stage / clock_start /
    age_hours / slo_status), then the queue's row (state.json["rows"], key state), then nothing.
    """
    if not isinstance(st, dict):
        return None
    sup = (st.get("supervise") or {}).get("rows") if isinstance(st.get("supervise"), dict) else None
    r = sup.get(rid) if isinstance(sup, dict) else None
    if isinstance(r, dict):
        return {
            "state": r.get("stage_label") or r.get("stage"),
            "since": r.get("clock_start"),
            "age_h": r.get("age_hours"),
            "slo": r.get("slo_status") or "unknown",
            "last_activity": r.get("last_activity"),
            "hold": r.get("hold"),
            "cost_hold": r.get("cost_hold"),
            "pr": r.get("pr"),
        }
    rows = st.get("rows")
    if isinstance(rows, dict) and isinstance(rows.get(rid), dict):
        q = rows[rid]
        return {
            "state": q.get("state"),
            "since": q.get("since") or q.get("dispatched_at"),
            "age_h": q.get("age_h"),
            "slo": q.get("slo") or "unknown",
            "last_activity": q.get("last_activity"),
            "hold": q.get("hold"),
            "cost_hold": q.get("cost_hold"),
            "pr": q.get("pr") or (q.get("ledger") or {}).get("pr"),
        }
    return None


def fmt_h(h):
    return "?" if h is None else f"{h:g}h"


def build(dirpath: str, now, plan_sha_local, plan_path, default_offset, paths: dict | None = None) -> dict:
    """`paths` overrides the per-file location (name -> path); anything else is read from `dirpath`."""
    notes = []
    overrides = {k: v for k, v in (paths or {}).items() if v}

    def where(name: str) -> str:
        return overrides.get(name) or os.path.join(dirpath, name)

    ledger_text, err = load_text(where("ledger.md"))
    ledger = parse_ledger(ledger_text or "", default_offset)
    if err:
        notes.append(f"ledger.md {err}")
    elif not ledger["header_found"]:
        notes.append("ledger.md: header row not found (row-id | ... | merged/blocked)")
    if ledger["duplicates"]:
        notes.append(f"ledger duplicates (last wins): {', '.join(ledger['duplicates'])}")
    for sp in ledger["spelling"]:
        notes.append(f"ledger row-id cell {sp['cell']!r} read as {sp['row']}; make the cell the bare id")

    alerts_text, err = load_text(where("alerts.md"))
    alerts = parse_alerts(alerts_text or "")
    if err:
        notes.append(f"alerts.md {err}")

    state, err = load_json(where("state.json"))
    if err or not isinstance(state, dict):
        notes.append(f"state.json {err or 'is not an object'} (stages from the ledger only; SLOs unknown)")
        state = {}
    config, err = load_json(where("config.json"))
    if err or not isinstance(config, dict):
        config = state.get("config") if isinstance(state.get("config"), dict) else {}
        notes.append(f"config.json {err}; using state.json's copy" if config else f"config.json {err}")
    prs, err = load_json(where("prs.json"))
    if err:
        notes.append(f"prs.json {err} (gh unavailable or not run)")
        prs = []
    if not isinstance(prs, list):
        prs = []

    dispatchable, derr = dispatchable_from_plan(plan_path)
    if derr:
        notes.append(f"dispatchable count: {dispatchable} ({derr})")

    tick_at = parse_iso(state.get("generated_at"))
    tick_age = hours_between(now, tick_at)

    in_flight, merged, blocked = [], [], []
    for rid, r in sorted(ledger["rows"].items()):
        {"merged": merged, "blocked": blocked}.get(r["outcome"], in_flight).append(rid)

    state_wip = state.get("wip")
    wip_limit = (config or {}).get("wip", state_wip.get("limit", 3) if isinstance(state_wip, dict) else (state_wip or 3))
    paused = bool((config or {}).get("paused", state.get("paused", False)))
    paused_rows = list((config or {}).get("paused_rows") or [])

    row_lines = []
    breaches = []
    for rid in in_flight:
        lr = ledger["rows"][rid]
        srow = row_state_from_state(state, rid) or {}
        stage = srow.get("state") or lr["stage"]
        since = parse_iso(srow.get("since")) or parse_iso(lr["spec_accepted_at"]) or parse_iso(lr["dispatched_at"])
        age = srow.get("age_h") if isinstance(srow.get("age_h"), (int, float)) else hours_between(now, since)
        slo = srow.get("slo") or ("unknown" if not state else "ok")
        last = srow.get("last_activity") or lr["spec_accepted_at"] or lr["dispatched_at"]
        last_h = hours_between(now, parse_iso(last))
        flags = []
        if srow.get("hold"):
            flags.append(f"hold:{srow['hold']}")
        if srow.get("cost_hold"):
            flags.append("cost_hold")
        if rid in paused_rows:
            flags.append("paused")
        pr = srow.get("pr") or lr["pr"]
        src = "state" if srow else "ledger"
        row_lines.append(
            f"  {rid:<12} {stage:<14} age {fmt_h(age):<6} last activity {fmt_h(last_h):<6} slo {slo:<9}"
            f"{' PR #' + str(pr) if pr else '':<9} [{src}]{' ' + ' '.join(flags) if flags else ''}"
        )
        if slo == "breached":
            breaches.append(f"{rid} {stage} {fmt_h(age)}")
    for a in state.get("actions") or []:
        if isinstance(a, dict) and a.get("kind") in ("escalate", "alert") and a.get("row"):
            entry = f"{a['row']} {a.get('alert_kind') or a.get('state') or a.get('reason') or ''}".strip()
            if entry not in breaches:
                breaches.append(entry + " (pending escalation)")

    recent_alerts = []
    for a in alerts:
        at = parse_iso(a["at"])
        h = hours_between(now, at)
        if h is not None and h <= ALERT_WINDOW_H:
            recent_alerts.append(a["line"])

    plan_state = state.get("plan") if isinstance(state.get("plan"), dict) else {}
    box_sha = plan_state.get("sha256")
    pinned_sha = (config or {}).get("plan_sha256")
    plan_changed = bool(plan_sha_local and box_sha and plan_sha_local != box_sha) or bool(
        pinned_sha and box_sha and pinned_sha != box_sha
    )

    pr_lines = []
    fork_counts = {"open": 0, "draft": 0, "merged": 0, "closed": 0}
    for p in sorted(prs, key=lambda p: p.get("number") or 0, reverse=True):
        st = (p.get("state") or "").upper()
        if st == "OPEN":
            fork_counts["open"] += 1
            if p.get("isDraft"):
                fork_counts["draft"] += 1
        elif st == "MERGED":
            fork_counts["merged"] += 1
        elif st == "CLOSED":
            fork_counts["closed"] += 1
        head = (p.get("headRefOid") or "")[:7]
        pr_lines.append(
            f"  #{p.get('number')}: {st}{' draft' if p.get('isDraft') else ''} {head} "
            f"{(p.get('title') or '')[:70]} (updated {p.get('updatedAt') or '?'})"
        )

    queued = max(0, dispatchable - len(ledger["rows"]))
    eligible = state.get("eligible_next") or []
    eligible_ids = [(e.get("id") or e.get("row")) if isinstance(e, dict) else str(e) for e in eligible][:5]

    # The a | b | t | r report (abtr.py) from the same inputs; a render bug must not sink the scorecard.
    abtr_markdown = abtr_brief = None
    if abtr is None:
        notes.append("abtr.py missing next to scorecard.py: a|b|t|r markdown not rendered")
    else:
        try:
            kw = {"prs": prs, "alerts": alerts, "config": config, "dispatchable": dispatchable}
            abtr_markdown = abtr.render_abtr_markdown(state, ledger["rows"], now, **kw)
            abtr_brief = abtr.render_abtr_brief(state, ledger["rows"], now, **kw)
        except Exception as exc:  # noqa: BLE001 - any render bug degrades to the text card and is named in notes
            notes.append(f"a|b|t|r render failed: {type(exc).__name__}: {exc}")

    return {
        "abtr_markdown": abtr_markdown,
        "abtr_brief": abtr_brief,
        "now": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "notes": notes,
        "tick_at": state.get("generated_at"),
        "tick_age_h": tick_age,
        "tick_stale": tick_age is None or tick_age > TICK_STALE_H,
        "paused": paused,
        "paused_rows": paused_rows,
        "wip_limit": wip_limit,
        "in_flight": in_flight,
        "merged": merged,
        "blocked": blocked,
        "blocked_reasons": {rid: ledger["rows"][rid]["outcome_cell"] for rid in blocked},
        "queued": queued,
        "dispatchable": dispatchable,
        "other_rows": ledger["other_rows"],
        "id_spelling": ledger["spelling"],
        "row_lines": row_lines,
        "breaches": breaches,
        "alerts_total": len(alerts),
        "recent_alerts": recent_alerts,
        "plan_sha_local": plan_sha_local,
        "plan_sha_box": box_sha,
        "plan_sha_pinned": pinned_sha,
        "plan_changed": plan_changed,
        "fork_counts": fork_counts,
        "pr_lines": pr_lines,
        "eligible_next": eligible_ids,
        "collector_errors": state.get("collector_errors") or [],
        "attention": bool(breaches or recent_alerts or plan_changed or ledger["spelling"] or (tick_age is None or tick_age > TICK_STALE_H)),
    }


def render(card: dict) -> str:
    out = []
    p = out.append
    p(f"HERMES AUTOPILOT CHECK  {card['now']}")
    status = "ATTENTION" if card["attention"] else "quiet"
    p(f"status: {status}   in flight {len(card['in_flight'])}/{card['wip_limit']}"
      f"{'   DISPATCH PAUSED' if card['paused'] else ''}"
      f"{'   paused rows: ' + ', '.join(card['paused_rows']) if card['paused_rows'] else ''}")
    tick = card["tick_at"] or "never"
    p(f"last tick: {tick} ({fmt_h(card['tick_age_h'])} ago){'  STALE (>3h)' if card['tick_stale'] else ''}")
    p("")
    p(f"rows: merged {len(card['merged'])} · in flight {len(card['in_flight'])} · blocked {len(card['blocked'])}"
      f" · queued {card['queued']} (of {card['dispatchable']} dispatchable; ledger also holds {len(card['other_rows'])} non-matrix rows)")
    if card["merged"]:
        p(f"  merged:  {', '.join(card['merged'])}")
    if card["blocked"]:
        for rid in card["blocked"]:
            p(f"  blocked: {rid}: {card['blocked_reasons'].get(rid, '')}")
    p("")
    p("in flight:")
    out.extend(card["row_lines"] or ["  none"])
    p("")
    p("SLO breaches: " + (", ".join(card["breaches"]) if card["breaches"] else "none"))
    p(f"alerts in the last 6h: {len(card['recent_alerts'])} (file total {card['alerts_total']})")
    for line in card["recent_alerts"][:10]:
        p(f"  {line}")
    p("")
    plan = "CHANGED" if card["plan_changed"] else "unchanged"
    p(f"plan hash: {plan}  local {(card['plan_sha_local'] or '?')[:12]}  box {(card['plan_sha_box'] or '?')[:12]}"
      f"  pinned {(card['plan_sha_pinned'] or '-')[:12]}")
    fc = card["fork_counts"]
    p(f"fork PRs: open {fc['open']} (draft {fc['draft']}) · merged {fc['merged']} · closed {fc['closed']}")
    out.extend(card["pr_lines"][:12])
    if card["eligible_next"]:
        p(f"next eligible: {', '.join(card['eligible_next'])}")
    if card["collector_errors"]:
        p(f"collector errors on the last tick: {len(card['collector_errors'])}")
        for e in card["collector_errors"][:5]:
            src = e.get("source") if isinstance(e, dict) else "?"
            msg = e.get("error") if isinstance(e, dict) else str(e)
            p(f"  {src}: {' '.join(str(msg).split())[:100]}")
    if card["notes"]:
        p("")
        p("notes:")
        for n in card["notes"]:
            p(f"  {n}")
    return "\n".join(out) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description="Hermes autopilot scorecard (read-only)")
    ap.add_argument("--dir", required=True)
    ap.add_argument("--now", default=None)
    ap.add_argument("--plan-sha256", default=None, help="sha256 of the git copy of dispatch-plan.md")
    ap.add_argument("--plan", default=None, help="path to the git copy of dispatch-plan.md (dispatchable count)")
    ap.add_argument("--ledger-tz-offset", default="+05:30", help="zone for ledger stamps without a named zone")
    ap.add_argument("--json", action="store_true", help="emit the scorecard as JSON instead of text")
    for name in ("ledger", "alerts", "state", "config", "prs"):
        ap.add_argument(f"--{name}", default=None, help=f"path of {name}.{'md' if name in ('ledger', 'alerts') else 'json'} (default: <dir>/)")
    ap.add_argument("--markdown", nargs="?", const="-", default=None, metavar="PATH",
                    help="print the a|b|t|r markdown report instead of the text card; write it to PATH (atomic) when given")
    ap.add_argument("--brief", nargs="?", const="-", default=None, metavar="PATH",
                    help="print the tick's brief (header + one line per in-flight row); write it to PATH when given")
    args = ap.parse_args()
    now = parse_iso(args.now) or datetime.now(timezone.utc)
    sign = -1 if args.ledger_tz_offset.startswith("-") else 1
    hh, mm = args.ledger_tz_offset.lstrip("+-").split(":")
    offset = sign * timedelta(hours=int(hh), minutes=int(mm))
    paths = {"ledger.md": args.ledger, "alerts.md": args.alerts, "state.json": args.state, "config.json": args.config, "prs.json": args.prs}
    card = build(args.dir, now, args.plan_sha256, args.plan, offset, paths)
    if args.json:
        json.dump(card, sys.stdout, indent=2, default=str)
        sys.stdout.write("\n")
        return 0
    if args.markdown is None and args.brief is None:
        sys.stdout.write(render(card))
        return 0
    rc = 0
    for flag, key in (("markdown", "abtr_markdown"), ("brief", "abtr_brief")):
        dest = getattr(args, flag)
        if dest is None:
            continue
        text = card.get(key)
        if not text:
            why = "; ".join(n for n in card["notes"] if "abtr" in n or "a|b|t|r" in n) or "not rendered"
            sys.stderr.write(f"scorecard: --{flag}: {why}\n")
            rc = 1
            continue
        sys.stdout.write(text)
        if dest != "-":
            try:
                abtr.write_atomic(dest, text)
            except OSError as exc:
                sys.stderr.write(f"scorecard: --{flag}: cannot write {dest}: {exc}\n")
                rc = 1
    return rc


if __name__ == "__main__":
    sys.exit(main())
