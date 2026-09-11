#!/usr/bin/env python3
"""Fixture-driven tests for ops/nemoclaw-coworkers/rows-board.py: a temp checkout with a small
dispatch-plan.md, one fake card set on hermes-LOOP-F35, a state.json, and the Orchestrator's two
tables (ledger.md § Carried criteria, upstream-asks.md); the board must render index.html and
<ROW>.html, symlink the card dir, show both tables, and exit 0 on an empty root too.
Run: python3 -m unittest ops/nemoclaw-coworkers/autopilot/test_rows_board.py
"""

from __future__ import annotations

import html
import json
import os
import subprocess
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
BOARD = HERE.parent / "rows-board.py"
NOW_DT = datetime(2026, 9, 10, 12, 0, tzinfo=timezone.utc)
NOW = "2026-09-10T12:00:00Z"
PLAN = """# Hermes port — dispatch plan (fixture)

## Batch 1a — phase P2 — the compose plugin

| Row | Name | Disp | Deliverable | AC kind |
|---|---|---|---|---|
| **LOOP-F35** | Lego coworker composition | BUILD | one plugin | pytest |

## Batch 1b — phase P2 — CONFIGURE rows

**Wave 1 — retention**

| Row | Name | Deliverable | AC |
|---|---|---|---|
| MEM-F44 | Memory retention | keys | pytest |

## Adopt: doc page + hermetic acceptance test only

**Attaches to P2**

| Row | Name | What Hermes already provides | AC |
|---|---|---|---|
| ISO-F17 | Sandbox proof | sandbox | doc |
"""
# The Orchestrator's ledger: the work-item table plus the `## Carried criteria` table. The covered
# row is written BEFORE the open one on purpose: the board must list open criteria first.
LEDGER = """# Hermes PORT — work-item ledger

| row-id | dispatched | spec accepted | PR | verdict | merged/blocked | notes |
| --- | --- | --- | --- | --- | --- | --- |
| LOOP-F35 | 2026-09-09 10:00 IST (to hermes-architect, thread `hermes-LOOP-F35`) | 2026-09-09 12:00 IST | #7 | PASS | — | autopilot dispatch, batch 1a, BUILD; carried criteria AC-LOOP-F35-5 |

## Carried criteria

| criterion | from row | to row | reason | decided | status |
| --- | --- | --- | --- | --- | --- |
| AC-LOOP-F35-6 | LOOP-F35 | ISO-F17 | mount set is ISO-F17's deliverable | msg 4242 2026-09-10 | covered (#12) |
| AC-LOOP-F35-5 | LOOP-F35 | MEM-F44 | the veto half needs the gates plugin; compose only renders the key | operator 2026-09-10 | open |
"""
LONG_ASK = ("`bot_mode_dm.py` spawns bare `hermes` as argv[0]; a venv install has no `hermes` on PATH, so the DM bot dies "
            "at start-up under the fixture's install layout and every downstream row inherits the failure")
UPSTREAM_ASKS = f"""# Upstream asks

Core-change candidates the plugin surface cannot absorb.

## Upstream asks

| id | source row | citation | ask | disposition | owner | updated |
| --- | --- | --- | --- | --- | --- | --- |
| UA-1 | LOOP-F35 | /workspace/extra/hermes-release/tools/bot_mode_dm.py:316 | {LONG_ASK} | bypassed (wrapper on PATH in the fixture, not filed) | orchestrator | 2026-09-10 |
| UA-2 | MEM-F44 | /workspace/extra/hermes-release/hermes_cli/plugins.py:12 | plugin load hook must see name and alias pairs | open | — | 2026-09-10 |
"""


def put(path: Path, data, hours_ago: float = 1.0) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, bytes):
        path.write_bytes(data)
    else:
        path.write_text(data, encoding="utf-8")
    ts = (NOW_DT - timedelta(hours=hours_ago)).timestamp()
    os.utime(path, (ts, ts))


def board(root: Path, www: Path, *extra: str, env: dict | None = None) -> subprocess.CompletedProcess:
    e = {k: v for k, v in os.environ.items() if k != "DASHBOARD_URL"}
    e.update(env or {})
    return subprocess.run([sys.executable, str(BOARD), "--root", str(root), "--www", str(www), "--now", NOW, *extra],
                          capture_output=True, text=True, env=e, check=False)


class RowsBoardTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "checkout"
        self.www = Path(self.tmp.name) / "www"
        put(self.root / "docs" / "hermes-port" / "dispatch-plan.md", PLAN)
        cards = self.root / "groups" / "hermes-tester" / "reports" / "hermes-LOOP-F35" / "cards"
        put(cards / "card-hermes-tester-pass-r1.png", b"\x89PNG r1", hours_ago=5.0)
        put(cards / "card-hermes-tester-fail-r2.png", b"\x89PNG r2", hours_ago=2.0)
        put(cards / "card-hermes-tester-fail-r2.html", "<html>card</html>", hours_ago=2.0)
        put(cards / "card-hermes-tester-fail-r2.json", "{}", hours_ago=2.0)
        put(cards / "card-hermes-tester-latest.png", b"\x89PNG r2", hours_ago=2.0)
        put(cards / "card-hermes-tester-latest.html", "<html>card</html>", hours_ago=2.0)
        put(cards / "notes.txt", "ignored", hours_ago=2.0)
        bcards = self.root / "groups" / "hermes-builder" / "reports" / "hermes-LOOP-F35" / "cards"
        put(bcards / "card-hermes-builder-shipped-r1.png", b"\x89PNG b", hours_ago=6.0)
        # a thread with cards that the plan does not list
        put(self.root / "groups" / "orchestrator" / "reports" / "hermes-P0-LOOP" / "cards" / "card-orchestrator-merged-r1.png", b"\x89PNG o", hours_ago=30.0)
        ap = self.root / "data" / "shared" / "hermes" / "autopilot"
        put(ap / "state.json", json.dumps({
            "generated_at": (NOW_DT - timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "rows": {"LOOP-F35": {"state": "testing"}, "MEM-F44": {"state": "queued"}},
            "supervise": {"rows": {"LOOP-F35": {"stage": "building", "hold": None, "cost_hold": False}}},
        }))
        put(ap / "threads.json", json.dumps({"generated_at": (NOW_DT - timedelta(hours=5)).strftime("%Y-%m-%dT%H:%M:%SZ"), "threads": {}}))
        self.reports = self.root / "groups" / "orchestrator" / "reports"
        put(self.reports / "ledger.md", LEDGER)
        put(self.reports / "upstream-asks.md", UPSTREAM_ASKS)

    def tearDown(self):
        self.tmp.cleanup()

    def test_index_batches_rows_and_latest_thumbnails(self):
        proc = board(self.root, self.www)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("wrote", proc.stdout)
        index = (self.www / "rows" / "index.html").read_text(encoding="utf-8")
        self.assertIn("Batch 1a", index)
        self.assertIn("Batch 1b", index)
        self.assertIn("Adopt track", index)
        self.assertLess(index.index("Batch 1a"), index.index("Batch 1b"))
        self.assertIn('<a href="LOOP-F35.html"><b>LOOP-F35</b></a>', index)
        self.assertIn("MEM-F44", index)
        self.assertIn("ISO-F17", index)
        # the tester's latest card: 180 px thumbnail from the -latest copy, verdict colour from the newest real card (FAIL r2)
        self.assertIn('<img class="thumb bad" src="cards/hermes-tester/hermes-LOOP-F35/card-hermes-tester-latest.png" width="180"', index)
        self.assertIn('<div class="v bad">FAIL r2 · 2.0h</div>', index)
        # the builder has no -latest copy: the card itself is the thumbnail, coloured ok
        self.assertIn('<img class="thumb ok" src="cards/hermes-builder/hermes-LOOP-F35/card-hermes-builder-shipped-r1.png" width="180"', index)
        self.assertIn("SHIPPED r1", index)
        # stage from the supervisor block, and the unplanned thread section
        self.assertIn('<td class="stage">building</td>', index)
        self.assertIn("not in the plan", index)
        self.assertIn("P0-LOOP", index)
        # threads.json 5 h old: stale banner; state.json 30 min old: none
        self.assertIn("threads.json is stale", index)
        self.assertNotIn("state.json is stale", index)
        self.assertNotIn("plan unreadable", index)
        self.assertIn("4 cards on disk · 2 threads with cards", index)

    def test_row_page_lists_every_card_newest_first_with_links(self):
        proc = board(self.root, self.www, env={"DASHBOARD_URL": "http://dash.example:8080/"})
        self.assertEqual(proc.returncode, 0, proc.stderr)
        page = (self.www / "rows" / "LOOP-F35.html").read_text(encoding="utf-8")
        self.assertIn("<title>LOOP-F35 · Lego coworker composition</title>", page)
        order = [page.index(x) for x in ("card-hermes-tester-fail-r2.png", "card-hermes-tester-pass-r1.png", "card-hermes-builder-shipped-r1.png")]
        self.assertEqual(order, sorted(order))
        self.assertIn('<a href="cards/hermes-tester/hermes-LOOP-F35/card-hermes-tester-fail-r2.html">html</a>', page)
        self.assertIn('<a href="cards/hermes-tester/hermes-LOOP-F35/card-hermes-tester-fail-r2.json">json</a>', page)
        self.assertIn('<a href="../adr/">/adr/</a>', page)
        self.assertIn('<a href="../test-reports/hermes-LOOP-F35/">/test-reports/hermes-LOOP-F35/</a>', page)
        self.assertIn('<a href="http://dash.example:8080/#/cw/orchestrator/l/hermes-LOOP-F35">dashboard lane</a>', page)
        self.assertIn("stage: <b>building</b>", page)
        self.assertIn("hermes-tester · FAIL · round 2", page)
        # a planned row without cards still gets a page; no dashboard link without DASHBOARD_URL
        mem = (self.www / "rows" / "MEM-F44.html").read_text(encoding="utf-8")
        self.assertIn("no cards yet", mem)
        proc = board(self.root, self.www)
        self.assertNotIn("dashboard lane", (self.www / "rows" / "LOOP-F35.html").read_text(encoding="utf-8"))

    def test_card_dirs_are_symlinked_under_rows_cards(self):
        board(self.root, self.www)
        link = self.www / "rows" / "cards" / "hermes-tester" / "hermes-LOOP-F35"
        self.assertTrue(link.is_symlink())
        self.assertEqual(os.readlink(link), str(self.root / "groups" / "hermes-tester" / "reports" / "hermes-LOOP-F35" / "cards"))
        self.assertTrue((link / "card-hermes-tester-latest.png").exists())
        # idempotent: a second run keeps the link and rewrites the pages
        proc = board(self.root, self.www)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertTrue(link.is_symlink())

    def test_empty_root_renders_an_empty_board_and_exits_zero(self):
        empty = Path(self.tmp.name) / "empty"
        empty.mkdir()
        proc = board(empty, self.www)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        index = (self.www / "rows" / "index.html").read_text(encoding="utf-8")
        self.assertIn("plan unreadable", index)
        self.assertIn("no state.json yet", index)
        self.assertIn("no threads.json yet", index)
        self.assertIn("no rows: no readable plan and no cards yet", index)
        self.assertIn("carried criteria unavailable — ledger.md not found", index)
        self.assertIn("upstream asks unavailable — upstream-asks.md not found", index)

    def test_broken_state_and_stale_state_are_banners_not_crashes(self):
        ap = self.root / "data" / "shared" / "hermes" / "autopilot"
        put(ap / "state.json", "{not json")
        proc = board(self.root, self.www)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        index = (self.www / "rows" / "index.html").read_text(encoding="utf-8")
        self.assertIn("state.json unreadable", index)
        self.assertIn("LOOP-F35", index)
        put(ap / "state.json", json.dumps({"generated_at": "2026-09-01T00:00:00Z", "rows": {}}))
        board(self.root, self.www)
        index = (self.www / "rows" / "index.html").read_text(encoding="utf-8")
        self.assertIn("state.json is stale: generated 2026-09-01T00:00:00Z (9d ago)", index)

    def test_unsafe_row_id_renders_as_plain_text_without_a_page(self):
        # a thread dir whose row part is not a safe filename: listed, never linked, no <ROW>.html written
        put(self.root / "groups" / "orchestrator" / "reports" / "hermes-.." / "cards" / "card-orchestrator-blocked-r1.png", b"\x89PNG u", hours_ago=1.0)
        proc = board(self.root, self.www)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("skipping row id '..'", proc.stderr)
        index = (self.www / "rows" / "index.html").read_text(encoding="utf-8")
        self.assertIn("<b>..</b>", index)
        self.assertNotIn('href="...html"', index)
        self.assertFalse((self.www / "rows" / "...html").exists())
        self.assertIn('<a href="LOOP-F35.html"><b>LOOP-F35</b></a>', index)

    def test_unwritable_www_does_not_raise(self):
        proc = board(self.root, Path("/dev/null/www"))
        self.assertEqual(proc.returncode, 0)
        self.assertIn("rows-board: failed", proc.stderr)


if __name__ == "__main__":
    unittest.main()


FAKE_NCL = """#!/usr/bin/env python3
import json, sys
# fake `ncl sessions list --limit N --json`
print(json.dumps({"ok": True, "data": [
  {"id": "sess-arch", "agent_group_id": "ag-arch", "thread_id": "hermes-LOOP-F35", "status": "active", "container_status": "stopped", "last_active": "2026-09-10T11:30:00Z", "group_folder": "hermes-architect"},
  {"id": "sess-build-live", "agent_group_id": "ag-build", "thread_id": "hermes-LOOP-F35", "status": "active", "container_status": "running", "last_active": "2026-09-10T11:55:00Z", "group_folder": "hermes-builder"},
  {"id": "sess-build-twin", "agent_group_id": "ag-build", "thread_id": "hermes-LOOP-F35", "status": "active", "container_status": "stopped", "last_active": "2026-09-10T07:40:00Z", "group_folder": "hermes-builder"},
  {"id": "sess-test", "agent_group_id": "ag-test", "thread_id": "hermes-LOOP-F35", "status": "active", "container_status": "stopped", "last_active": "2026-09-10T10:00:00Z", "group_folder": "hermes-tester"},
  {"id": "sess-other", "agent_group_id": "ag-test", "thread_id": "gh-issue-x", "status": "active", "container_status": "running", "last_active": "2026-09-10T11:59:00Z", "group_folder": "hermes-tester"}
]}))
"""


class LiveStatusTest(unittest.TestCase):
    """Green/amber/red/grey dots from `ncl sessions list` + the supervisor's row state."""

    def setUp(self):
        RowsBoardTest.setUp(self)   # same fixture checkout, without inheriting (and re-running) its tests
        self.ncl = Path(self.tmp.name) / "fake-ncl"
        self.ncl.write_text(FAKE_NCL, encoding="utf-8")
        os.chmod(self.ncl, 0o755)
        ap = self.root / "data" / "shared" / "hermes" / "autopilot"
        put(ap / "threads.json", json.dumps({
            "generated_at": (NOW_DT - timedelta(minutes=10)).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "roles": {"hermes-architect": "ag-arch", "hermes-builder": "ag-build", "hermes-tester": "ag-test", "hermes-reviewer": "ag-rev", "orchestrator": "ag-orch"},
            "threads": {},
        }))
        put(ap / "state.json", json.dumps({
            "generated_at": (NOW_DT - timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "rows": {"LOOP-F35": {"state": "building"}},
            "supervise": {"rows": {"LOOP-F35": {"stage": "building", "hold": None, "cost_hold": True, "target_role": "hermes-builder",
                                                 "cost_hold_sessions": [{"role": "hermes-architect", "session_id": "sess-arch", "cost_status": "escalated"}]}}},
        }))

    def test_dots_per_role_and_row(self):
        proc = board(self.root, self.www, "--ncl", str(self.ncl), env={"DASHBOARD_URL": "http://dash.example:8080"})
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("4 live sessions on 1 rows", proc.stdout)   # 4 on hermes-LOOP-F35; the gh-issue-x session is not a row
        index = (self.www / "rows" / "index.html").read_text(encoding="utf-8")
        self.assertNotIn("live status unavailable", index)
        # architect: on a cost card -> red; builder: running container -> green (the stopped twin does not matter);
        # tester: session, no container -> amber; reviewer: nothing -> grey
        self.assertIn('<span class="dot red"></span>needs input · cost card pending', index)
        self.assertIn('<span class="dot green"></span>working · last active 5m ago', index)
        self.assertIn('<span class="dot amber"></span>idle · last active 2.0h ago', index)
        self.assertIn('<span class="dot grey"></span>no session', index)
        # row dot is red because one role needs input; orchestrator line present
        self.assertIn('<td><span class="dot red" title="needs input"></span><a href="LOOP-F35.html">', index)
        self.assertIn("orchestrator: no session", index)
        # a row with no sessions at all stays grey
        self.assertIn('<span class="dot grey" title="no session"></span><a href="MEM-F44.html">', index)
        page = (self.www / "rows" / "LOOP-F35.html").read_text(encoding="utf-8")
        self.assertIn("Live sessions", page)
        self.assertIn('href="http://dash.example:8080/#/cw/hermes-builder/s/sess-build-live"', page)
        self.assertIn("running / active", page)

    def test_missing_ncl_degrades_to_grey_with_banner(self):
        proc = board(self.root, self.www, "--ncl", str(Path(self.tmp.name) / "nope"))
        self.assertEqual(proc.returncode, 0, proc.stderr)
        index = (self.www / "rows" / "index.html").read_text(encoding="utf-8")
        self.assertIn("live status unavailable", index)
        self.assertIn('<span class="dot grey"></span>no session', index)
        # supervisor state still paints red without ncl
        self.assertIn("cost card pending", index)

    def tearDown(self):
        self.tmp.cleanup()


class CarriedTablesTest(unittest.TestCase):
    """ledger.md § Carried criteria and upstream-asks.md on the board: index sections (open first, a
    phase-name target flagged), the `carries N` badge, the row pages' Carries / Deferred-from blocks,
    and banners instead of crashes when a table is missing, unreadable or malformed."""

    def setUp(self):
        RowsBoardTest.setUp(self)   # the same fixture checkout (ledger + upstream-asks included)

    def tearDown(self):
        self.tmp.cleanup()

    def render(self, *extra: str) -> tuple:
        proc = board(self.root, self.www, *extra)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        return proc, (self.www / "rows" / "index.html").read_text(encoding="utf-8")

    def page(self, rid: str) -> str:
        return (self.www / "rows" / f"{rid}.html").read_text(encoding="utf-8")

    def test_index_sections_open_first_and_badge_on_the_target_row(self):
        proc, index = self.render()
        self.assertIn("1/2 carried criteria open, 2 upstream asks", proc.stdout)
        self.assertIn("<h2>Carried criteria <small>1 open · 2 total</small></h2>", index)
        # open first, whatever the file order (the fixture writes the covered row first)
        self.assertLess(index.index("<code>AC-LOOP-F35-5</code>"), index.index("<code>AC-LOOP-F35-6</code>"))
        self.assertIn('<a href="LOOP-F35.html">LOOP-F35</a> → <a href="MEM-F44.html">MEM-F44</a>', index)
        self.assertIn('<span class="st open">open</span>', index)
        self.assertIn('<span class="st ok">covered (#12)</span>', index)
        self.assertIn("the veto half needs the gates plugin; compose only renders the key", index)
        self.assertIn("<small>operator 2026-09-10</small>", index)
        # the badge sits on the target row only
        self.assertIn('<a href="MEM-F44.html"><b>MEM-F44</b></a><span class="badge" title="carries open criteria: AC-LOOP-F35-5">carries 1</span>', index)
        self.assertEqual(index.count('class="badge"'), 1)
        self.assertIn("· 1 open carried criteria · 1 open upstream asks</p>", index)
        # upstream asks: open first, disposition detail kept, the long ask truncated with the full text in title
        self.assertIn("<h2>Upstream asks <small>1 open · 2 total</small></h2>", index)
        self.assertLess(index.index("<b>UA-2</b>"), index.index("<b>UA-1</b>"))
        self.assertIn('<span class="st off">bypassed (wrapper on PATH in the fixture, not filed)</span>', index)
        self.assertIn(f'<span title="{html.escape(LONG_ASK, quote=True)}">', index)
        self.assertIn('inherits the failure">', index)      # the full text rides in the title attribute...
        self.assertIn("start-u…</span>", index)             # ...the cell is truncated at 120 chars
        self.assertNotIn("inherits the failure</span>", index)
        self.assertIn("<code>/workspace/extra/hermes-release/tools/bot_mode_dm.py:316</code>", index)
        self.assertIn('<td>{}</td>'.format('<a href="MEM-F44.html">MEM-F44</a>'), index)
        self.assertNotIn("not a plan row", index)

    def test_phase_name_target_is_flagged_never_a_plan_row(self):
        # the LOOP-F35 gap as written: "deferred to P4" — a phase, which no row carries
        put(self.reports / "ledger.md", LEDGER + "| AC-LOOP-F35-7 | LOOP-F35 | P4 | sandbox proof | operator 2026-09-10 | open |\n")
        proc, index = self.render()
        self.assertIn("2/3 carried criteria open", proc.stdout)
        self.assertIn('<span class="st bad" title="not a plan row: a deferral names a target ROW, never a phase">P4 · not a plan row</span>', index)
        self.assertEqual(index.count('class="badge"'), 1)   # P4 is not a row: nothing to badge
        self.assertIn("· 2 open carried criteria ·", index)
        self.assertIn("P4 · not a plan row", self.page("LOOP-F35"))
        # a DEFER-batch target is flagged the same way
        put(self.root / "docs" / "hermes-port" / "dispatch-plan.md", PLAN + "\n## Defer\n\n| Row | Name | Why |\n|---|---|---|\n| CH-F53 | WeChat | later |\n")
        put(self.reports / "ledger.md", LEDGER + "| AC-LOOP-F35-7 | LOOP-F35 | CH-F53 | sandbox proof | operator 2026-09-10 | open |\n")
        _, index = self.render()
        self.assertIn("CH-F53 · DEFER row", index)

    def test_row_pages_carry_and_deferred_blocks(self):
        self.render()
        mem = self.page("MEM-F44")
        self.assertIn("<h2>Carries <small>1 open · 1 total</small></h2>", mem)
        self.assertIn("<code>AC-LOOP-F35-5</code>", mem)
        self.assertIn('<td><a href="LOOP-F35.html">LOOP-F35</a></td>', mem)
        self.assertIn("merge gate (P5) is red otherwise", mem)
        self.assertIn("nothing deferred from this row", mem)
        self.assertIn("<h2>Upstream asks from this row <small>1</small></h2>", mem)
        self.assertIn("<b>UA-2</b>", mem)
        self.assertNotIn("<b>UA-1</b>", mem)
        self.assertIn('thread <code>hermes-MEM-F44</code><span class="badge" title="carries open criteria: AC-LOOP-F35-5">carries 1</span>', mem)
        loop = self.page("LOOP-F35")
        self.assertIn("carries no criteria from other rows", loop)
        self.assertIn("<h2>Deferred from this row <small>1 open · 2 total</small></h2>", loop)
        self.assertLess(loop.index("<code>AC-LOOP-F35-5</code>"), loop.index("<code>AC-LOOP-F35-6</code>"))
        self.assertIn('<td><a href="MEM-F44.html">MEM-F44</a></td>', loop)
        self.assertIn('<td><a href="ISO-F17.html">ISO-F17</a></td>', loop)
        self.assertIn("<b>UA-1</b>", loop)
        self.assertNotIn('class="badge"', loop)
        iso = self.page("ISO-F17")
        self.assertIn("<h2>Carries <small>0 open · 1 total</small></h2>", iso)
        self.assertIn('<span class="st ok">covered (#12)</span>', iso)
        self.assertNotIn("Upstream asks from this row", iso)

    def test_missing_unreadable_or_malformed_tables_are_banners(self):
        (self.reports / "ledger.md").unlink()
        (self.reports / "upstream-asks.md").unlink()
        proc, index = self.render()
        self.assertIn("carried criteria unavailable — ledger.md not found", index)
        self.assertIn("upstream asks unavailable — upstream-asks.md not found", index)
        self.assertIn("ledger.md not found", proc.stderr)
        self.assertIn('<a href="LOOP-F35.html"><b>LOOP-F35</b></a>', index)
        self.assertIn("ledger.md not found", self.page("MEM-F44"))
        # not UTF-8: unreadable, still exit 0 and the rest of the board renders
        put(self.reports / "ledger.md", b"\xff\xfe\x00 not text")
        put(self.reports / "upstream-asks.md", b"\xff\xfe")
        _, index = self.render()
        self.assertIn("ledger.md unreadable: UnicodeDecodeError", index)
        self.assertIn("upstream-asks.md unreadable: UnicodeDecodeError", index)
        self.assertIn("4 cards on disk", index)
        # a malformed status reads as open (the parser's fail-safe), shown in red with the raw text, and is counted
        put(self.reports / "ledger.md", LEDGER + "| AC-LOOP-F35-8 | LOOP-F35 | MEM-F44 | dup | operator | later |\n")
        put(self.reports / "upstream-asks.md", "")   # the box today: the file exists and is empty
        proc, index = self.render()
        self.assertIn("ledger.md § Carried criteria: carried criterion AC-LOOP-F35-8: status &#x27;later&#x27; is not open", index)
        self.assertIn("open · unparsed later</span>", index)
        self.assertIn('title="carries open criteria: AC-LOOP-F35-5, AC-LOOP-F35-8">carries 2</span>', index)
        self.assertIn("no upstream asks recorded", index)
        self.assertIn("<h2>Upstream asks <small>0 open · 0 total</small></h2>", index)
        # a ledger without the section: no carried criteria, no banner
        put(self.reports / "ledger.md", LEDGER.split("## Carried criteria")[0])
        _, index = self.render()
        self.assertIn("no carried criteria recorded", index)
        self.assertNotIn("carried criteria unavailable", index)
        self.assertEqual(index.count('class="badge"'), 0)

    def test_ledger_and_upstream_asks_flags_override_the_root_paths(self):
        other = Path(self.tmp.name) / "elsewhere"
        put(other / "led.md", LEDGER.replace("| MEM-F44 |", "| ISO-F17 |"))
        put(other / "ua.md", UPSTREAM_ASKS.replace("UA-2", "UA-9"))
        (self.reports / "ledger.md").unlink()
        _, index = self.render("--ledger", str(other / "led.md"), "--upstream-asks", str(other / "ua.md"))
        self.assertNotIn("ledger.md not found", index)
        self.assertIn('<a href="ISO-F17.html"><b>ISO-F17</b></a><span class="badge" title="carries open criteria: AC-LOOP-F35-5">carries 1</span>', index)
        self.assertIn("<b>UA-9</b>", index)
        self.assertNotIn("<b>UA-2</b>", index)
