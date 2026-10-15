#!/usr/bin/env python3
"""Verify the cost ledger against the OneCLI gateway. READ-ONLY.

The runner's `cost_events` ledger (per session, outbound.db) is what the cost cap
enforces. The OneCLI gateway's `request_logs` hold the usage each Anthropic
response actually reported (body tap: `usage_*` keys, `usage_source=sse`). They
share no id, but each Claude call has a near-unique (input, cache-read,
cache-write) token tuple, so a ledger row joins to the gateway call with the same
tuple within +/- WINDOW seconds.

The ledger is append-only: a call's first report is its base row `<id>` and
every later top-up or model correction is a signed row `<id>#<seq>`. This script
folds each call's rows back into one (tokens summed under the call's latest
model, dollars summed over all rows) before joining.

Two modes.

--session <id>: one session. Reports
  - ledger calls matched / unmatched to a gateway call
  - output tokens: ledger vs gateway on the matched rows (the #1329 bug: the
    ledger kept the start-of-stream snapshot, ~1% of output)
  - dollars: ledger vs gateway tokens priced with the runner's own rate table
  - backstop residual rows (modelUsage settlement; signed: a call that reports
    after its turn settled claims its share back) and adjustments, separately
  Exit 0 = every matched ledger row carries the gateway's exact tokens.

--fleet [--hours 24 | --since ISO]: the daily drift check. Every session whose
  ledger has a Claude call first reported in the window, joined against its
  agent group's gateway calls (one gateway query per group; a gateway call joins
  at most one ledger call fleet-wide). FAIL when
    - any matched call's output tokens differ from the gateway's, or
    - matched-$ drift exceeds BOTH --max-usd-drift-pct and --max-usd-drift-abs
      fleet-wide, or
    - a session with >= --min-calls ledger calls matches fewer than
      --min-match-frac of them (the gateway lost the calls, or the ledger's
      input tuple drifted).
  Gateway calls that match no ledger call — nested `claude --print` runs inside
  review skills, which the session counter intentionally does not count, and
  calls of sessions outside this checkout — are REPORTED per group, never
  alerted on.
  Exit 0 = PASS, 2 = FAIL (drift), 1 = the check could not run.

Usage (on the box, from the checkout):
  python3 scripts/verify-cost-ledger-vs-gateway.py --session sess-...
  python3 scripts/verify-cost-ledger-vs-gateway.py --session sess-... --json
  python3 scripts/verify-cost-ledger-vs-gateway.py --fleet --hours 24 --json

Never writes: SQLite opened with mode=ro, Postgres only SELECTs via
`docker exec <pg> psql -tAc`.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sqlite3
import subprocess
import sys
from datetime import datetime, timedelta, timezone

GROUP_RE = re.compile(r"ag-[a-z0-9-]+")
LEDGER_SQL = (
    "select id, ts, model, input_tokens, output_tokens, cache_read_tokens, cache_write_5m_tokens, "
    "cache_write_1h_tokens, cache_write_tokens, priced_usd, adjustment_usd from cost_events "
    "where provider = 'claude' order by rowid"
)
# Gateway row layout: [observed_at_ms, model, input, output, cache_read,
# cache_write_total, cache_write_5m (-1 = unsplit), cache_write_1h (-1), matched]
MATCHED = 8


class CheckError(Exception):
    """The check could not run (missing pricing, gateway unreachable, bad id)."""


def load_rates(checkout: str) -> dict[str, dict[str, float]]:
    """Parse MODEL_PRICING out of the runner's pricing.ts (one source of truth)."""
    with open(
        os.path.join(checkout, "container/agent-runner/src/pricing.ts"),
        encoding="utf-8",
    ) as f:
        src = f.read()
    rates = {}
    pat = r"'([a-z0-9.-]+)':\s*\{\s*input:\s*([\d.e-]+),\s*output:\s*([\d.e-]+),\s*cacheCreate:\s*([\d.e-]+),\s*cacheRead:\s*([\d.e-]+)\s*\}"
    for m in re.finditer(pat, src):
        rates[m.group(1)] = {
            "input": float(m.group(2)),
            "output": float(m.group(3)),
            "cacheCreate": float(m.group(4)),
            "cacheRead": float(m.group(5)),
        }
    if not rates:
        raise CheckError("could not parse MODEL_PRICING from pricing.ts")
    return rates


def normalize_model(model: str | None, rates: dict) -> str:
    """Mirror of normalizeModel() in container/agent-runner/src/pricing.ts."""
    if not model:
        return ""
    m = model.strip().lower()
    m = re.sub(r"\[1m\]$", "", m)
    for prefix in (
        "aws/anthropic/bedrock-",
        "aws/anthropic/",
        "azure/anthropic/",
        "anthropic/",
    ):
        if m.startswith(prefix):
            m = m[len(prefix) :]
            break
    m = re.sub(r"-v\d+$", "", m)
    if m in rates:
        return m
    undated = re.sub(r"-\d{8}$", "", m)
    return undated if undated in rates else ""


def price(
    rates: dict,
    model: str,
    inp: int,
    out: int,
    cr: int,
    cw5: int,
    cw1h: int,
    cwflat: int,
) -> float:
    r = rates.get(normalize_model(model, rates))
    if not r:
        return 0.0
    return (
        inp * r["input"]
        + out * r["output"]
        + cr * r["cacheRead"]
        + (cw5 + cwflat) * r["cacheCreate"]
        + cw1h * r["input"] * 2
    )


def row_usd(r: tuple, rates: dict) -> float:
    """A ledger row's dollars at the CURRENT rates (priced_usd is a write-time cache)."""
    return price(
        rates, r[2], r[3] or 0, r[4] or 0, r[5] or 0, r[6] or 0, r[7] or 0, r[8] or 0
    ) + (r[10] or 0)


def gateway_usd(g: list, fallback_model: str, rates: dict) -> float:
    """A gateway call's dollars, priced with the runner's table."""
    cw5 = max(g[6], 0)
    cw1h = max(g[7], 0)
    flat = g[5] if g[6] < 0 and g[7] < 0 else 0
    return price(rates, g[1] or fallback_model, g[2], g[3], g[4], cw5, cw1h, flat)


def fold_call(base: str, rs: list[tuple], rates: dict) -> tuple:
    """One call's append-only rows -> one row, like loadClaudeMessage() in cost-events.ts.

    Rows arrive in rowid order. Tokens are summed over the rows under the call's
    latest model (a model correction appends a negative row under the old model
    and the full usage under the new one); dollars are summed over every row; the
    timestamp is the first report's. Dollars are repriced at the current rates,
    like sumWindow() reprices token rows.
    """
    model = rs[-1][2]
    tok = [0] * 6
    for r in rs:
        if r[2] != model:
            continue
        for i in range(6):
            tok[i] += r[3 + i] or 0
    return (base, rs[0][1], model, *tok, sum(row_usd(r, rates) for r in rs), 0, len(rs))


def iso_ms(ts: str) -> int:
    return int(datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp() * 1000)


def load_ledger(db_path: str) -> list[tuple]:
    """Every Claude ledger row of one session, rowid order. Read-only; [] without a ledger."""
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        has = con.execute(
            "select 1 from sqlite_master where type = 'table' and name = 'cost_events'"
        ).fetchone()
        return con.execute(LEDGER_SQL).fetchall() if has else []
    finally:
        con.close()


def split_ledger(rows: list[tuple], rates: dict, since_ms: int | None = None):
    """Rows -> (folded calls, residual rows, adjustment rows).

    With since_ms, keep the calls FIRST reported at or after it — folded over all
    their rows, so a top-up after the cut-off never stands alone as a partial
    call — and the residual / adjustment rows stamped at or after it.
    """
    residual, adjustments = [], []
    calls: dict[str, list[tuple]] = {}
    for r in rows:
        rid = r[0]
        if rid.startswith("adj:") or (r[10] or 0) != 0:
            adjustments.append(r)
        elif ":residual:" in rid:
            residual.append(r)
        else:
            calls.setdefault(rid.split("#", 1)[0], []).append(r)
    messages = [fold_call(base, rs, rates) for base, rs in calls.items()]
    if since_ms is not None:
        messages = [m for m in messages if iso_ms(m[1]) >= since_ms]
        residual = [r for r in residual if iso_ms(r[1]) >= since_ms]
        adjustments = [r for r in adjustments if iso_ms(r[1]) >= since_ms]
    return messages, residual, adjustments


def gateway_sql(group: str, t0: datetime, t1: datetime) -> str:
    if not GROUP_RE.fullmatch(group):
        raise CheckError(f"unexpected agent group id {group!r}")
    # created_at is a UTC `timestamp` (no zone): format the bounds in UTC, or an
    # offset-bearing --since shifts the query window by the offset.
    t0 = t0.astimezone(timezone.utc)
    t1 = t1.astimezone(timezone.utc)
    return (
        "select (extra_data->>'usage_observed_at_ms')::bigint, extra_data->>'usage_model', "
        "coalesce((extra_data->>'usage_input_tokens')::bigint,0), coalesce((extra_data->>'usage_output_tokens')::bigint,0), "
        "coalesce((extra_data->>'usage_cache_read_input_tokens')::bigint,0), "
        "coalesce((extra_data->>'usage_cache_creation_input_tokens')::bigint,0), "
        "coalesce((extra_data->>'usage_cache_creation_5m_input_tokens')::bigint,-1), "
        "coalesce((extra_data->>'usage_cache_creation_1h_input_tokens')::bigint,-1) "
        "from request_logs r join agents a on a.id = r.agent_id "
        f"where a.identifier = '{group}' and r.status between 200 and 299 and r.path not like '%count_tokens%' "
        "and r.extra_data ? 'usage_input_tokens' and r.extra_data->>'usage_api' like 'anthropic%' "
        f"and r.created_at between '{t0:%Y-%m-%d %H:%M:%S}' and '{t1:%Y-%m-%d %H:%M:%S}'"
    )


def psql(container: str, user: str, db: str, sql: str) -> list[list[str]]:
    try:
        out = subprocess.run(
            ["docker", "exec", container, "psql", "-U", user, "-d", db, "-tAc", sql],
            capture_output=True,
            text=True,
            check=True,
            timeout=300,
        ).stdout
    except (OSError, subprocess.SubprocessError) as e:
        detail = getattr(e, "stderr", None) or ""
        raise CheckError(f"gateway query failed: {e} {detail.strip()[:300]}") from e
    return [line.split("|") for line in out.strip().split("\n") if line]


def fetch_gateway(pg: argparse.Namespace, group: str, t0: datetime, t1: datetime) -> list[list]:
    rows = psql(pg.pg_container, pg.pg_user, pg.pg_db, gateway_sql(group, t0, t1))
    try:
        return [[int(x) if i != 1 else x for i, x in enumerate(r)] + [False] for r in rows]
    except ValueError as e:
        raise CheckError(f"unexpected gateway row for {group}: {e}") from e


def index_gateway(gw: list[list]) -> dict[tuple[int, int, int], list[list]]:
    index: dict[tuple[int, int, int], list[list]] = {}
    for g in gw:
        index.setdefault((g[2], g[4], g[5]), []).append(g)
    return index


def match_calls(messages: list[tuple], index: dict, window_s: int):
    """Join each ledger call to the nearest unmatched gateway call with its tuple.

    Marks the joined gateway rows (g[MATCHED]) so a gateway call joins at most
    one ledger call even across sessions sharing the index.
    """
    matched, unmatched = [], []
    for r in messages:
        key = (r[3], r[5], (r[6] or 0) + (r[7] or 0) + (r[8] or 0))
        t = iso_ms(r[1])
        best = None
        for g in index.get(key, []):
            if g[MATCHED] or abs(g[0] - t) > window_s * 1000:
                continue
            if best is None or abs(g[0] - t) < abs(best[0] - t):
                best = g
        if best is None:
            unmatched.append(r)
        else:
            best[MATCHED] = True
            matched.append((r, best))
    return matched, unmatched


def session_report(session, group, messages, residual, adjustments, matched, unmatched, rates) -> dict:
    led_usd = sum(r[9] for r, _ in matched)
    gw_usd = sum(gateway_usd(g, r[2], rates) for r, g in matched)
    mismatches = [
        {"call": r[0], "ts": r[1], "ledger_output": r[4], "gateway_output": g[3]}
        for r, g in matched
        if r[4] != g[3]
    ]
    return {
        "session": session,
        "agent_group": group,
        "ledger_calls": len(messages),
        "ledger_call_rows": sum(m[11] for m in messages),
        "matched": len(matched),
        "unmatched_ledger_rows": len(unmatched),
        "matched_rows_with_exact_output": len(matched) - len(mismatches),
        "output_tokens": {
            "ledger": sum(r[4] for r, _ in matched),
            "gateway": sum(g[3] for _, g in matched),
        },
        "usd_matched": {"ledger": round(led_usd, 6), "gateway_priced": round(gw_usd, 6)},
        "residual_rows": {
            "count": len(residual),
            "usd": round(sum(row_usd(r, rates) for r in residual), 6),
        },
        "adjustment_rows": {
            "count": len(adjustments),
            "usd": round(sum(row_usd(r, rates) for r in adjustments), 6),
        },
        "output_mismatches": mismatches,
    }


def gateway_window(messages: list[tuple]) -> tuple[datetime, datetime]:
    t0 = datetime.fromtimestamp(min(iso_ms(r[1]) for r in messages) / 1000, tz=timezone.utc)
    t1 = datetime.fromtimestamp(max(iso_ms(r[1]) for r in messages) / 1000, tz=timezone.utc)
    return t0 - timedelta(minutes=10), t1 + timedelta(minutes=10)


def run_session(a: argparse.Namespace, rates: dict) -> tuple[dict, int]:
    hits = glob.glob(os.path.join(a.checkout, "data/v2-sessions", "*", a.session, "outbound.db"))
    if not hits:
        raise CheckError(f"no outbound.db for {a.session} under data/v2-sessions/*/")
    db_path = hits[0]
    group = db_path.split(os.sep)[-3]
    rows = load_ledger(db_path)
    since_ms = iso_ms(a.since) if a.since else None
    messages, residual, adjustments = split_ledger(rows, rates, since_ms)
    if not messages:
        raise CheckError("no Claude message rows in the ledger for this session")
    t0, t1 = gateway_window(messages)
    gw = fetch_gateway(a, group, t0, t1)
    matched, unmatched = match_calls(messages, index_gateway(gw), a.window)
    report = session_report(a.session, group, messages, residual, adjustments, matched, unmatched, rates)
    report["ledger_total_usd"] = round(
        sum(row_usd(r, rates) for r in rows if since_ms is None or iso_ms(r[1]) >= since_ms), 6
    )
    report["gateway_rows_in_range_for_group"] = len(gw)
    report["note"] = (
        "gateway rows in range include the group's other sessions and nested CLI runs; "
        "only matched rows are this session's"
    )
    ok = len(matched) > 0 and not report["output_mismatches"]
    report["verdict"] = "PASS" if ok else "FAIL"
    return report, 0 if ok else 2


def discover_sessions(checkout: str) -> list[tuple[str, str, str]]:
    """(agent_group, session, outbound.db path) for every session under this checkout."""
    out = []
    for p in sorted(glob.glob(os.path.join(checkout, "data/v2-sessions", "*", "*", "outbound.db"))):
        parts = p.split(os.sep)
        out.append((parts[-3], parts[-2], p))
    return out


def run_fleet(a: argparse.Namespace, rates: dict, now: datetime | None = None) -> tuple[dict, int]:
    now = now or datetime.now(timezone.utc)
    since = (
        datetime.fromisoformat(a.since.replace("Z", "+00:00"))
        if a.since
        else now - timedelta(hours=a.hours)
    )
    if since.tzinfo is None:
        since = since.replace(tzinfo=timezone.utc)
    since_ms = int(since.timestamp() * 1000)

    by_group: dict[str, list[tuple]] = {}
    for group, session, path in discover_sessions(a.checkout):
        try:
            rows = load_ledger(path)
        except sqlite3.Error as e:
            raise CheckError(f"cannot read {path}: {e}") from e
        messages, residual, adjustments = split_ledger(rows, rates, since_ms)
        if messages:
            by_group.setdefault(group, []).append((session, messages, residual, adjustments))

    sessions: list[dict] = []
    groups: dict[str, dict] = {}
    t0 = since - timedelta(minutes=10)
    t1 = now + timedelta(minutes=10)
    for group in sorted(by_group):
        gw = fetch_gateway(a, group, t0, t1)
        index = index_gateway(gw)
        for session, messages, residual, adjustments in by_group[group]:
            matched, unmatched = match_calls(messages, index, a.window)
            sessions.append(
                session_report(session, group, messages, residual, adjustments, matched, unmatched, rates)
            )
        # Gateway calls in the window that no ledger call claimed: nested
        # `claude --print` runs (intentionally uncounted) and sessions outside
        # this checkout. Reported, never alerted.
        extra = [g for g in gw if not g[MATCHED] and g[0] >= since_ms]
        groups[group] = {
            "gateway_calls": sum(1 for g in gw if g[0] >= since_ms),
            "unmatched_gateway_calls": len(extra),
            "unmatched_gateway_output_tokens": sum(g[3] for g in extra),
            "unmatched_gateway_usd": round(sum(gateway_usd(g, "", rates) for g in extra), 6),
        }

    led_usd = sum(s["usd_matched"]["ledger"] for s in sessions)
    gw_usd = sum(s["usd_matched"]["gateway_priced"] for s in sessions)
    drift = led_usd - gw_usd
    drift_pct = (abs(drift) / gw_usd * 100) if gw_usd else (100.0 if drift else 0.0)

    alerts: list[str] = []
    for s in sessions:
        mm = s["output_mismatches"]
        if mm:
            alerts.append(
                f"output tokens differ on {len(mm)}/{s['matched']} matched calls in "
                f"{s['agent_group']}/{s['session']}: ledger "
                f"{sum(m['ledger_output'] for m in mm)} vs gateway "
                f"{sum(m['gateway_output'] for m in mm)} (first: {mm[0]['call']})"
            )
    if abs(drift) > a.max_usd_drift_abs and drift_pct > a.max_usd_drift_pct:
        alerts.append(
            f"matched-$ drift {drift:+.2f} USD ({drift_pct:.2f}%): ledger ${led_usd:.2f} "
            f"vs gateway ${gw_usd:.2f}"
        )
    for s in sessions:
        n = s["ledger_calls"]
        frac = s["matched"] / n if n else 1.0
        s["matched_fraction"] = round(frac, 4)
        if n >= a.min_calls and frac < a.min_match_frac:
            alerts.append(
                f"low match: {s['agent_group']}/{s['session']} matched {s['matched']}/{n} "
                f"ledger calls ({frac:.0%} < {a.min_match_frac:.0%})"
            )

    report = {
        "mode": "fleet",
        "since": since.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "until": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sessions_checked": len(sessions),
        "ledger_calls": sum(s["ledger_calls"] for s in sessions),
        "matched": sum(s["matched"] for s in sessions),
        "output_mismatches": sum(len(s["output_mismatches"]) for s in sessions),
        "usd_matched": {
            "ledger": round(led_usd, 6),
            "gateway_priced": round(gw_usd, 6),
            "drift": round(drift, 6),
            "drift_pct": round(drift_pct, 4),
        },
        "thresholds": {
            "max_usd_drift_pct": a.max_usd_drift_pct,
            "max_usd_drift_abs": a.max_usd_drift_abs,
            "min_match_frac": a.min_match_frac,
            "min_calls": a.min_calls,
        },
        "unmatched_gateway_by_group": groups,
        "alerts": alerts,
        "sessions": sessions,
        "verdict": "FAIL" if alerts else "PASS",
    }
    return report, 2 if alerts else 0


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    mode = ap.add_mutually_exclusive_group(required=True)
    mode.add_argument("--session", help="nanoclaw session id (sess-...)")
    mode.add_argument("--fleet", action="store_true", help="every session active in the window")
    ap.add_argument("--checkout", default=os.getcwd(), help="nanoclaw checkout (default: cwd)")
    ap.add_argument(
        "--pg-container",
        default=os.environ.get("ONECLI_PG_CONTAINER") or "onecli-postgres-1",
    )
    ap.add_argument("--pg-user", default=os.environ.get("ONECLI_PG_USER") or "onecli")
    ap.add_argument("--pg-db", default=os.environ.get("ONECLI_PG_DB") or "onecli")
    ap.add_argument("--window", type=int, default=300, help="join window, seconds (default 300)")
    ap.add_argument("--since", help="only ledger calls first reported at or after this ISO time")
    ap.add_argument("--hours", type=float, default=24, help="--fleet window when --since is absent (default 24)")
    ap.add_argument("--max-usd-drift-pct", type=float, default=1.0, help="--fleet: alert above this %% ... (default 1)")
    ap.add_argument("--max-usd-drift-abs", type=float, default=1.0, help="--fleet: ... AND above this many USD (default 1)")
    ap.add_argument("--min-match-frac", type=float, default=0.9, help="--fleet: per-session matched fraction floor (default 0.9)")
    ap.add_argument("--min-calls", type=int, default=10, help="--fleet: sessions with fewer ledger calls skip the match floor (default 10)")
    ap.add_argument("--json", action="store_true")
    return ap


def main(argv: list[str] | None = None) -> int:
    a = build_parser().parse_args(argv)
    try:
        rates = load_rates(a.checkout)
        report, rc = run_fleet(a, rates) if a.fleet else run_session(a, rates)
    except (CheckError, OSError, ValueError) as e:
        if a.json:
            print(json.dumps({"verdict": "ERROR", "error": str(e)}))
        else:
            print(f"ERROR: {e}", file=sys.stderr)
        return 1
    if a.json:
        print(json.dumps(report, indent=2))
    elif a.fleet:
        for k, v in report.items():
            if k not in ("sessions", "alerts"):
                print(f"{k:34s} {v}")
        for line in report["alerts"]:
            print(f"ALERT {line}")
    else:
        for k, v in report.items():
            print(f"{k:34s} {v}")
    return rc


if __name__ == "__main__":
    sys.exit(main())
