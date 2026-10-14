#!/usr/bin/env python3
"""Verify one session's cost ledger against the OneCLI gateway. READ-ONLY.

The runner's `cost_events` ledger (per session, outbound.db) is what the cost cap
enforces. The OneCLI gateway's `request_logs` hold the usage each Anthropic
response actually reported (body tap: `usage_*` keys, `usage_source=sse`). They
share no id, but each Claude call has a near-unique (input, cache-read,
cache-write) token tuple, so a ledger row joins to the gateway call with the same
tuple within +/- WINDOW seconds.

Reports, for the session:
  - ledger message rows matched / unmatched to a gateway call
  - output tokens: ledger vs gateway on the matched rows (the #1329 bug: the
    ledger kept the start-of-stream snapshot, ~1% of output)
  - dollars: ledger vs gateway tokens priced with the runner's own rate table
  - backstop residual rows (modelUsage settlement) and adjustments, separately

Exit status 0 = every matched ledger row carries the gateway's exact tokens.

Usage (on the box, from the checkout):
  python3 scripts/verify-cost-ledger-vs-gateway.py --session sess-...
  python3 scripts/verify-cost-ledger-vs-gateway.py --session sess-... --json

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
        sys.exit("could not parse MODEL_PRICING from pricing.ts")
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


def find_session_db(checkout: str, session: str) -> tuple[str, str]:
    hits = glob.glob(
        os.path.join(checkout, "data/v2-sessions", "*", session, "outbound.db")
    )
    if not hits:
        sys.exit(f"no outbound.db for {session} under data/v2-sessions/*/")
    path = hits[0]
    return path, path.split(os.sep)[-3]


def iso_ms(ts: str) -> int:
    return int(datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp() * 1000)


def psql(container: str, user: str, db: str, sql: str) -> list[list[str]]:
    out = subprocess.run(
        ["docker", "exec", container, "psql", "-U", user, "-d", db, "-tAc", sql],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return [line.split("|") for line in out.strip().split("\n") if line]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--session", required=True, help="nanoclaw session id (sess-...)")
    ap.add_argument(
        "--checkout", default=os.getcwd(), help="nanoclaw checkout (default: cwd)"
    )
    ap.add_argument(
        "--pg-container",
        default=os.environ.get("ONECLI_PG_CONTAINER") or "onecli-postgres-1",
    )
    ap.add_argument("--pg-user", default=os.environ.get("ONECLI_PG_USER") or "onecli")
    ap.add_argument("--pg-db", default=os.environ.get("ONECLI_PG_DB") or "onecli")
    ap.add_argument(
        "--window", type=int, default=300, help="join window, seconds (default 300)"
    )
    ap.add_argument("--since", help="only ledger rows with ts >= this ISO time")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    rates = load_rates(a.checkout)
    db_path, group = find_session_db(a.checkout, a.session)
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    q = (
        "select id, ts, model, input_tokens, output_tokens, cache_read_tokens, cache_write_5m_tokens, "
        "cache_write_1h_tokens, cache_write_tokens, priced_usd, adjustment_usd from cost_events where provider = 'claude'"
    )
    params: tuple = ()
    if a.since:
        q += " and ts >= ?"
        params = (a.since,)
    rows = con.execute(q, params).fetchall()
    con.close()

    messages, residual, adjustments = [], [], []
    for r in rows:
        rid = r[0]
        if rid.startswith("adj:") or (r[10] or 0) != 0:
            adjustments.append(r)
        elif ":residual:" in rid:
            residual.append(r)
        else:
            messages.append(r)
    if not messages:
        print("no Claude message rows in the ledger for this session")
        return 1

    t0 = datetime.fromtimestamp(
        min(iso_ms(r[1]) for r in messages) / 1000, tz=timezone.utc
    ) - timedelta(minutes=10)
    t1 = datetime.fromtimestamp(
        max(iso_ms(r[1]) for r in messages) / 1000, tz=timezone.utc
    ) + timedelta(minutes=10)
    gw_sql = (
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
    if not re.fullmatch(r"ag-[a-z0-9-]+", group):
        sys.exit(f"unexpected agent group id {group!r}")
    gw = [
        [int(x) if i != 1 else x for i, x in enumerate(r)]
        for r in psql(a.pg_container, a.pg_user, a.pg_db, gw_sql)
    ]
    index: dict[tuple[int, int, int], list[list]] = {}
    for g in gw:
        index.setdefault((g[2], g[4], g[5]), []).append(g + [False])

    matched, unmatched = [], []
    for r in messages:
        key = (r[3], r[5], (r[6] or 0) + (r[7] or 0) + (r[8] or 0))
        t = iso_ms(r[1])
        best = None
        for g in index.get(key, []):
            if g[8] or abs(g[0] - t) > a.window * 1000:
                continue
            if best is None or abs(g[0] - t) < abs(best[0] - t):
                best = g
        if best is None:
            unmatched.append(r)
        else:
            best[8] = True
            matched.append((r, best))

    led_out = sum(r[4] for r, _ in matched)
    gw_out = sum(g[3] for _, g in matched)
    led_usd = sum(r[9] for r, _ in matched)
    gw_usd = 0.0
    for r, g in matched:
        cw5 = max(g[6], 0)
        cw1h = max(g[7], 0)
        flat = g[5] if g[6] < 0 and g[7] < 0 else 0
        gw_usd += price(rates, g[1] or r[2], g[2], g[3], g[4], cw5, cw1h, flat)
    exact = sum(1 for r, g in matched if r[4] == g[3])
    report = {
        "session": a.session,
        "agent_group": group,
        "ledger_message_rows": len(messages),
        "matched": len(matched),
        "unmatched_ledger_rows": len(unmatched),
        "matched_rows_with_exact_output": exact,
        "output_tokens": {"ledger": led_out, "gateway": gw_out},
        "usd_matched": {
            "ledger": round(led_usd, 6),
            "gateway_priced": round(gw_usd, 6),
        },
        "residual_rows": {
            "count": len(residual),
            "usd": round(sum(r[9] for r in residual), 6),
        },
        "adjustment_rows": {
            "count": len(adjustments),
            "usd": round(sum(r[9] for r in adjustments), 6),
        },
        "ledger_total_usd": round(sum(r[9] for r in rows), 6),
        "gateway_rows_in_range_for_group": len(gw),
        "note": "gateway rows in range include the group's other sessions and nested CLI runs; only matched rows are this session's",
    }
    ok = len(matched) > 0 and exact == len(matched)
    report["verdict"] = "PASS" if ok else "FAIL"
    if a.json:
        print(json.dumps(report, indent=2))
    else:
        for k, v in report.items():
            print(f"{k:34s} {v}")
    return 0 if ok else 2


if __name__ == "__main__":
    sys.exit(main())
