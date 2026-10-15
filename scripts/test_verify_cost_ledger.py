#!/usr/bin/env python3
"""Tests for verify-cost-ledger-vs-gateway.py --fleet, the daily drift check.

The ledger kept ~1% of each call's output tokens for weeks (#1329, fixed by
#2013) and nothing noticed. Each test pins one way the daily check could fail to
notice it again, or cry wolf: an output-token drift, a dollar drift, a gateway
that stopped seeing the calls, and nested `claude --print` runs (intentionally
uncounted) that must be reported but never alerted on. Fixtures are a synthetic
outbound.db and stubbed psql output; no docker, no network.
Run: python3 -m unittest scripts/test_verify_cost_ledger.py
"""

from __future__ import annotations

import contextlib
import hashlib
import importlib.util
import io
import json
import os
import shutil
import sqlite3
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPT = HERE / "verify-cost-ledger-vs-gateway.py"
_spec = importlib.util.spec_from_file_location("verify_cost_ledger", SCRIPT)
vcl = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(vcl)

PRICING = HERE.parent / "container/agent-runner/src/pricing.ts"
NOW = datetime(2026, 10, 15, 6, 0, tzinfo=timezone.utc)
GROUP = "ag-reviewer"
MODEL = "claude-opus-5-5"


def iso(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")


def call(i: int, *, out: int = 500, model: str = MODEL, at: datetime | None = None) -> dict:
    """One Claude call: a near-unique (input, cache-read, cache-write) tuple."""
    return {
        "id": f"msg_{i:03d}",
        "ts": at or NOW - timedelta(hours=2, minutes=i),
        "model": model,
        "input": 10 + i,
        "out": out,
        "cr": 40_000 + i * 7,
        "cw5": 1_000 + i,
    }


def gw_row(c: dict, *, out: int | None = None, model: str | None = None, skew_s: int = 3) -> list[str]:
    """The gateway's view of call c, formatted the way `psql -tA` splits it."""
    t = int((c["ts"] + timedelta(seconds=skew_s)).timestamp() * 1000)
    return [
        str(t),
        model or c["model"],
        str(c["input"]),
        str(c["out"] if out is None else out),
        str(c["cr"]),
        str(c["cw5"]),
        str(c["cw5"]),
        "0",
    ]


class Fixture:
    def __init__(self) -> None:
        self.dir = tempfile.mkdtemp(prefix="vcl-test-")
        dst = Path(self.dir) / "container/agent-runner/src"
        dst.mkdir(parents=True)
        shutil.copy(PRICING, dst / "pricing.ts")
        self.gateway: dict[str, list[list[str]]] = {}
        self.queries: list[str] = []

    def session(self, sid: str, calls: list[dict], *, group: str = GROUP, extra_rows: list[tuple] = ()) -> str:
        d = Path(self.dir) / "data/v2-sessions" / group / sid
        d.mkdir(parents=True)
        path = str(d / "outbound.db")
        con = sqlite3.connect(path)
        con.execute(
            "create table cost_events (id text primary key, ts text not null, provider text not null, "
            "model text not null, input_tokens integer default 0, cache_read_tokens integer default 0, "
            "cache_write_tokens integer default 0, cache_write_5m_tokens integer default 0, "
            "cache_write_1h_tokens integer default 0, output_tokens integer default 0, "
            "reasoning_tokens integer default 0, priced_usd real not null, rate_version integer default 1, "
            "adjustment_usd real default 0, window_gen integer default 0, thread_id text, gh_ref text, "
            "created_at text not null)"
        )
        for c in calls:
            con.execute(
                "insert into cost_events (id, ts, provider, model, input_tokens, cache_read_tokens, "
                "cache_write_5m_tokens, output_tokens, priced_usd, created_at) values (?,?,?,?,?,?,?,?,?,?)",
                (c["id"], iso(c["ts"]), "claude", c["model"], c["input"], c["cr"], c["cw5"], c["out"], 0.0, iso(c["ts"])),
            )
        for r in extra_rows:
            con.execute(
                "insert into cost_events (id, ts, provider, model, input_tokens, cache_read_tokens, "
                "cache_write_5m_tokens, output_tokens, priced_usd, created_at) values (?,?,?,?,?,?,?,?,?,?)",
                r,
            )
        con.commit()
        con.close()
        return path

    def psql(self, container, user, db, sql):
        self.queries.append(sql)
        for group, rows in self.gateway.items():
            if f"a.identifier = '{group}'" in sql:
                return rows
        return []

    def run(self, *extra: str) -> tuple[int, dict]:
        args = vcl.build_parser().parse_args(["--fleet", "--checkout", self.dir, "--json", *extra])
        orig = vcl.psql
        vcl.psql = self.psql
        try:
            rates = vcl.load_rates(self.dir)
            report, rc = vcl.run_fleet(args, rates, now=NOW)
        finally:
            vcl.psql = orig
        return rc, report

    def close(self) -> None:
        shutil.rmtree(self.dir, ignore_errors=True)


class FleetDriftCheck(unittest.TestCase):
    def setUp(self) -> None:
        self.fx = Fixture()

    def tearDown(self) -> None:
        self.fx.close()

    def test_pass_when_every_matched_call_agrees(self):
        calls = [call(i) for i in range(12)]
        self.fx.session("sess-a", calls)
        self.fx.gateway[GROUP] = [gw_row(c) for c in calls]
        rc, rep = self.fx.run()
        self.assertEqual(rc, 0, rep["alerts"])
        self.assertEqual(rep["verdict"], "PASS")
        self.assertEqual(rep["matched"], 12)
        self.assertEqual(rep["output_mismatches"], 0)
        self.assertAlmostEqual(rep["usd_matched"]["drift"], 0.0, places=6)
        self.assertGreater(rep["usd_matched"]["gateway_priced"], 0)

    def test_output_token_drift_alerts(self):
        # The #1329 shape: the ledger kept the start-of-stream snapshot.
        calls = [call(i) for i in range(12)]
        calls[4]["out"] = 8
        self.fx.session("sess-a", calls)
        self.fx.gateway[GROUP] = [gw_row(c, out=500) for c in calls]
        rc, rep = self.fx.run()
        self.assertEqual(rc, 2)
        self.assertEqual(rep["verdict"], "FAIL")
        self.assertEqual(rep["output_mismatches"], 1)
        self.assertTrue(any("output tokens differ on 1/12" in a and "msg_004" in a for a in rep["alerts"]), rep["alerts"])

    def test_usd_drift_alerts_above_both_thresholds(self):
        # Tokens agree exactly; the ledger priced the calls as a cheaper model.
        calls = [call(i, model="claude-haiku-4-5", out=40_000) for i in range(12)]
        self.fx.session("sess-a", calls)
        self.fx.gateway[GROUP] = [gw_row(c, model=MODEL) for c in calls]
        rc, rep = self.fx.run()
        self.assertEqual(rc, 2)
        self.assertEqual(rep["output_mismatches"], 0)
        self.assertLess(rep["usd_matched"]["drift"], -1.0)
        self.assertTrue(any(a.startswith("matched-$ drift") for a in rep["alerts"]), rep["alerts"])

    def test_small_usd_drift_below_abs_threshold_passes(self):
        # Same relative drift on a tiny bill: > 1% but < $1, so not an alert.
        calls = [call(i, model="claude-haiku-4-5", out=10) for i in range(12)]
        for c in calls:
            c["cr"], c["cw5"] = 10 + c["input"], 0
        self.fx.session("sess-a", calls)
        self.fx.gateway[GROUP] = [gw_row(c, model=MODEL) for c in calls]
        rc, rep = self.fx.run()
        self.assertGreater(rep["usd_matched"]["drift_pct"], 1.0)
        self.assertLess(abs(rep["usd_matched"]["drift"]), 1.0)
        self.assertEqual(rc, 0, rep["alerts"])

    def test_unmatched_nested_cli_calls_reported_not_alerted(self):
        calls = [call(i) for i in range(12)]
        self.fx.session("sess-a", calls)
        nested = [call(100 + i, out=3_000) for i in range(5)]  # `claude --print` inside a review skill
        self.fx.gateway[GROUP] = [gw_row(c) for c in calls] + [gw_row(c) for c in nested]
        rc, rep = self.fx.run()
        self.assertEqual(rc, 0, rep["alerts"])
        g = rep["unmatched_gateway_by_group"][GROUP]
        self.assertEqual(g["gateway_calls"], 17)
        self.assertEqual(g["unmatched_gateway_calls"], 5)
        self.assertEqual(g["unmatched_gateway_output_tokens"], 15_000)
        self.assertGreater(g["unmatched_gateway_usd"], 0)

    def test_low_match_fraction_alerts(self):
        # The gateway stopped seeing this session's calls (tap broken, or the
        # ledger's input tuple drifted): only 5 of 12 join.
        calls = [call(i) for i in range(12)]
        self.fx.session("sess-a", calls)
        self.fx.gateway[GROUP] = [gw_row(c) for c in calls[:5]]
        rc, rep = self.fx.run()
        self.assertEqual(rc, 2)
        self.assertTrue(any("low match" in a and "5/12" in a for a in rep["alerts"]), rep["alerts"])

    def test_small_session_skips_match_floor(self):
        calls = [call(i) for i in range(3)]
        self.fx.session("sess-small", calls)
        self.fx.gateway[GROUP] = []
        rc, rep = self.fx.run()
        self.assertEqual(rc, 0, rep["alerts"])
        self.assertEqual(rep["sessions"][0]["matched_fraction"], 0.0)

    def test_gateway_call_joins_one_session_only(self):
        # Two sessions of one group with an identical call tuple: one gateway
        # call cannot vouch for both.
        c1 = call(1)
        c2 = dict(call(1), id="msg_dup")
        self.fx.session("sess-a", [c1])
        self.fx.session("sess-b", [c2])
        self.fx.gateway[GROUP] = [gw_row(c1)]
        _, rep = self.fx.run()
        self.assertEqual(rep["matched"], 1)
        self.assertEqual(len(self.fx.queries), 1, "one gateway query per group")

    def test_window_excludes_old_sessions_and_partial_calls(self):
        old = call(1, at=NOW - timedelta(hours=30))
        self.fx.session("sess-old", [old])
        # A call first reported before the window whose top-up lands inside it
        # is not a call of the window; it must not appear as a partial call.
        straddle = call(2, at=NOW - timedelta(hours=25))
        top_up = (
            "msg_002#1", iso(NOW - timedelta(hours=23)), "claude", MODEL, 0, 0, 0, 900, 0.0,
            iso(NOW - timedelta(hours=23)),
        )
        self.fx.session("sess-straddle", [straddle], extra_rows=[top_up])
        rc, rep = self.fx.run()
        self.assertEqual(rc, 0)
        self.assertEqual(rep["sessions_checked"], 0)
        self.assertEqual(self.fx.queries, [], "no gateway query without sessions in the window")

    def test_offset_since_queries_gateway_in_utc(self):
        self.fx.session("sess-a", [call(i) for i in range(2)])
        self.fx.run("--since", "2026-10-15T01:00:00+02:00")  # = 2026-10-14T23:00Z
        self.assertEqual(len(self.fx.queries), 1)
        self.assertIn("between '2026-10-14 22:50:00'", self.fx.queries[0])

    def test_check_is_read_only(self):
        calls = [call(i) for i in range(12)]
        path = self.fx.session("sess-a", calls)
        before = hashlib.sha256(Path(path).read_bytes()).hexdigest()
        self.fx.gateway[GROUP] = [gw_row(c) for c in calls]
        self.fx.run()
        self.assertEqual(hashlib.sha256(Path(path).read_bytes()).hexdigest(), before)
        self.assertEqual(sorted(os.listdir(Path(path).parent)), ["outbound.db"])
        for q in self.fx.queries:
            self.assertTrue(q.lower().startswith("select "), q)

    def test_gateway_failure_exits_1_with_error_json(self):
        self.fx.session("sess-a", [call(i) for i in range(12)])

        def boom(*_a):
            raise vcl.CheckError("gateway query failed: no such container")

        orig = vcl.psql
        vcl.psql = boom
        out = io.StringIO()
        try:
            with contextlib.redirect_stdout(out):
                # Pin the window to the fixtures: the real clock moves past NOW.
                rc = vcl.main(
                    ["--fleet", "--checkout", self.fx.dir, "--json", "--since", iso(NOW - timedelta(hours=24))]
                )
        finally:
            vcl.psql = orig
        self.assertEqual(rc, 1)
        self.assertEqual(json.loads(out.getvalue())["verdict"], "ERROR")

    def test_session_mode_still_works(self):
        calls = [call(i) for i in range(4)]
        self.fx.session("sess-a", calls)
        self.fx.gateway[GROUP] = [gw_row(c) for c in calls]
        orig = vcl.psql
        vcl.psql = self.fx.psql
        out = io.StringIO()
        try:
            with contextlib.redirect_stdout(out):
                rc = vcl.main(["--session", "sess-a", "--checkout", self.fx.dir, "--json"])
        finally:
            vcl.psql = orig
        rep = json.loads(out.getvalue())
        self.assertEqual(rc, 0)
        self.assertEqual(rep["verdict"], "PASS")
        self.assertEqual(rep["matched"], 4)


if __name__ == "__main__":
    unittest.main()
