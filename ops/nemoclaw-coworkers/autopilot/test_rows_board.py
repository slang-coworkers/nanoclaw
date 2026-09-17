#!/usr/bin/env python3
"""Fixture-driven tests for ops/nemoclaw-coworkers/rows-board.py: a temp checkout with a small
dispatch-plan.md, one fake card set on hermes-LOOP-F35, a state.json, and the Orchestrator's two
tables (ledger.md § Carried criteria, upstream-asks.md); the board must render index.html and
<ROW>.html, symlink the card dir, show both tables, and exit 0 on an empty root too. DemoPathPageTest:
the tracker lives on its own /rows/demo-path.html (+ demo-path.json for slack-rows.py), computed from the
same per-row records as the board; the index carries one link to it and nothing else of it.
Run: python3 -m unittest ops/nemoclaw-coworkers/autopilot/test_rows_board.py
"""

from __future__ import annotations

import contextlib
import html
import io
import json
import os
import re
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

    def test_batch5_row_renders_under_its_own_title_between_batch_4_and_the_adopt_track(self):
        """A `## Batch 5` plan section (FLEET-F62, the fleet assembly) renders as its own board section, titled from
        BATCH_TITLES["5"], in BATCH_ORDER position: after batch 4, before the adopt track."""
        plan = PLAN.replace(
            "## Adopt: doc page + hermetic acceptance test only",
            "## Batch 4 — phase P5-rooms-veto\n\n| Row | Name | Disp | Deliverable | AC |\n|---|---|---|---|---|\n"
            "| A2A-F21 | Runaway protection | CONFIGURE | keys | live |\n\n"
            "## Batch 5 — phase P6-fleet\n\n| Row | Name | Disp | Deliverable | AC |\n|---|---|---|---|---|\n"
            "| FLEET-F62 | Fleet assembly (P6): five sandboxed profiles on ONE gateway | BUILD | one gateway, five sandboxes | pytest |\n\n"
            "## Adopt: doc page + hermetic acceptance test only")
        put(self.root / "docs" / "hermes-port" / "dispatch-plan.md", plan)
        proc = board(self.root, self.www)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        index = (self.www / "rows" / "index.html").read_text(encoding="utf-8")
        title = "Batch 5 · P6-fleet · fleet assembly"
        self.assertIn(title, index)
        self.assertLess(index.index("Batch 1b"), index.index("Batch 4 · P5-rooms-veto"))
        self.assertLess(index.index("Batch 4 · P5-rooms-veto"), index.index(title))
        self.assertLess(index.index(title), index.index("Adopt track"))
        section = index[index.index(title):index.index("Adopt track")]
        self.assertIn('<a href="FLEET-F62.html"><b>FLEET-F62</b></a>', section)
        self.assertIn("1 rows", section)
        self.assertNotIn("A2A-F21", section)
        self.assertIn("BUILD", section)
        self.assertTrue((self.www / "rows" / "FLEET-F62.html").is_file())

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

    def test_follow_up_row_gets_its_own_section_and_page_when_it_has_cards_or_sessions(self):
        """A follow-up row (state.json `follow_up_rows`, `<PARENT>.<letter>`) is not a plan row and not an "unplanned" card
        thread: it renders under its own section with its parent named, and gets a page when a card dir or a live session
        exists on hermes-<ID>; a follow-up nothing has touched yet gets neither. Existing fixtures (no follow_up_rows) are
        byte-identical: the index test above still passes."""
        ap = self.root / "data" / "shared" / "hermes" / "autopilot"
        put(self.root / "groups" / "hermes-architect" / "reports" / "hermes-LOOP-F35.a" / "cards" / "card-hermes-architect-handoff-r1.png", b"\x89PNG fa", hours_ago=1.0)
        follow = {"follow_up": True, "parent": "LOOP-F35", "batch": "1a", "disposition": "BUILD", "name": "follow-up of LOOP-F35: Lego coworker composition",
                  "state": "dispatched", "state_reason": None, "ledger": {"pr": None}}
        put(ap / "state.json", json.dumps({
            "generated_at": (NOW_DT - timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "rows": {"LOOP-F35": {"state": "testing"}, "MEM-F44": {"state": "queued"}},
            "follow_up_rows": {"LOOP-F35.a": follow, "MEM-F44.a": {**follow, "parent": "MEM-F44", "batch": "1b", "disposition": "CONFIGURE", "name": "follow-up of MEM-F44: Memory retention"}},
            "supervise": {"rows": {"LOOP-F35": {"stage": "building", "hold": None, "cost_hold": False},
                                   "LOOP-F35.a": {"stage": "dispatched", "hold": None, "cost_hold": False, "follow_up": {"parent": "LOOP-F35", "batch": "1a"}}}},
        }))
        proc = board(self.root, self.www)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        index = (self.www / "rows" / "index.html").read_text(encoding="utf-8")
        self.assertIn("Follow-up rows", index)
        self.assertIn('<a href="LOOP-F35.a.html"><b>LOOP-F35.a</b></a>', index)
        self.assertIn("follow-up of LOOP-F35 · BUILD", index)
        self.assertLess(index.index("Adopt track"), index.index("Follow-up rows"))
        self.assertLess(index.index("Follow-up rows"), index.index("not in the plan"))
        self.assertIn('<td class="stage">dispatched</td>', index)
        self.assertNotIn("MEM-F44.a", index)  # no cards, no sessions: not on the board yet
        self.assertIn("P0-LOOP", index)  # the one legitimately unplanned card thread is still where it was
        page = (self.www / "rows" / "LOOP-F35.a.html").read_text(encoding="utf-8")
        self.assertIn("follow-up of LOOP-F35: Lego coworker composition", page)
        self.assertIn('follow-up of <a href="LOOP-F35.html">LOOP-F35</a> · BUILD · batch 1a', page)
        self.assertIn("stage: <b>dispatched</b>", page)
        self.assertIn("card-hermes-architect-handoff-r1.png", page)
        self.assertFalse((self.www / "rows" / "MEM-F44.a.html").exists())
        self.assertIn("5 cards on disk · 3 threads with cards", index)

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

    def test_miscased_thread_sessions_and_cards_attach_to_the_row(self):
        """ISO-F13, 2026-09-16: the reviewer was addressed with `hermes-loop-f35`; its session and its card dir spell the
        row lower-case. Both belong to LOOP-F35 on the board (dot, thumbnail, row page), the card URL and the symlink keep
        the real dir name, no "unplanned" row appears, the row page names the real thread, the summary line says so."""
        ncl = Path(self.tmp.name) / "fake-ncl-lower"
        ncl.write_text(FAKE_NCL.replace(
            '{"id": "sess-test",',
            '{"id": "sess-rev-lower", "agent_group_id": "ag-rev", "thread_id": "hermes-loop-f35", "status": "active", "container_status": "stopped", '
            '"last_active": "2026-09-10T11:00:00Z", "group_folder": "hermes-reviewer"},\n  {"id": "sess-test",'), encoding="utf-8")
        os.chmod(ncl, 0o755)
        lower = self.root / "groups" / "hermes-reviewer" / "reports" / "hermes-loop-f35" / "cards"
        put(lower / "card-hermes-reviewer-request_changes-r1.png", b"\x89PNG rc", hours_ago=1.0)
        put(lower / "card-hermes-reviewer-latest.png", b"\x89PNG rc", hours_ago=1.0)
        proc = board(self.root, self.www, "--ncl", str(ncl))
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn("5 live sessions on 1 rows", proc.stdout)
        self.assertIn("thread-case: LOOP-F35 hermes-reviewer sess-rev-lower on hermes-loop-f35, card dir hermes-loop-f35", proc.stdout)
        index = (self.www / "rows" / "index.html").read_text(encoding="utf-8")
        self.assertNotIn("loop-f35.html", index)  # no row of its own (P0-LOOP is the fixture's one legitimately unplanned thread)
        self.assertNotIn("<b>loop-f35</b>", index)
        # the reviewer's thumbnail sits in LOOP-F35's `r` cell and its URL keeps the real dir
        self.assertIn('src="cards/hermes-reviewer/hermes-loop-f35/card-hermes-reviewer-latest.png"', index)
        self.assertIn("REQUEST_CHANGES r1", index)
        self.assertIn('<span class="dot amber"></span>idle · last active 1.0h ago', index)  # the reviewer: a session, no container
        link = self.www / "rows" / "cards" / "hermes-reviewer" / "hermes-loop-f35"
        self.assertTrue(link.is_symlink())
        self.assertEqual(os.readlink(link), str(lower))
        page = (self.www / "rows" / "LOOP-F35.html").read_text(encoding="utf-8")
        self.assertIn("sess-rev-lower", page)
        self.assertIn(">thread hermes-loop-f35</span>", page)
        self.assertIn('href="cards/hermes-reviewer/hermes-loop-f35/card-hermes-reviewer-request_changes-r1.png"', page)
        self.assertNotIn("loop-f35.html", os.listdir(self.www / "rows"))  # by listing: the Mac's filesystem is case-insensitive

    def test_same_group_under_both_spellings_merges_into_one_entry(self):
        """A group that wrote cards under `hermes-loop-f35` AND `hermes-LOOP-F35`: one board entry, every card kept with
        its own dir (URLs resolve), both dirs symlinked, the newest `latest` per role wins — end to end through the script.
        Two case-variant dirs need a case-sensitive filesystem (the box; CI runs no Python suites), so on a Mac's APFS this
        one is skipped and test_two_spellings_of_one_card_dir_merge_on_any_filesystem covers the merge in-process."""
        probe = Path(self.tmp.name) / "CaseProbe"
        probe.write_text("x")
        if (Path(self.tmp.name) / "caseprobe").exists():
            self.skipTest("case-insensitive filesystem: hermes-LOOP-F35 and hermes-loop-f35 are one directory here")
        ncl = Path(self.tmp.name) / "fake-ncl-lower"
        ncl.write_text(FAKE_NCL, encoding="utf-8")
        os.chmod(ncl, 0o755)
        lower = self.root / "groups" / "hermes-reviewer" / "reports" / "hermes-loop-f35" / "cards"
        put(lower / "card-hermes-reviewer-request_changes-r1.png", b"\x89PNG rc", hours_ago=1.0)
        put(lower / "card-hermes-reviewer-latest.png", b"\x89PNG rc", hours_ago=1.0)
        upper = self.root / "groups" / "hermes-reviewer" / "reports" / "hermes-LOOP-F35" / "cards"
        put(upper / "card-hermes-reviewer-approve-r2.png", b"\x89PNG ok", hours_ago=0.5)
        put(upper / "card-hermes-reviewer-latest.png", b"\x89PNG ok", hours_ago=0.5)
        proc = board(self.root, self.www, "--ncl", str(ncl))
        self.assertEqual(proc.returncode, 0, proc.stderr)
        index = (self.www / "rows" / "index.html").read_text(encoding="utf-8")
        self.assertIn('src="cards/hermes-reviewer/hermes-LOOP-F35/card-hermes-reviewer-latest.png"', index)  # the newer latest wins
        self.assertIn("APPROVE r2", index)
        self.assertIn("thread-case: card dir hermes-loop-f35", proc.stdout)
        page = (self.www / "rows" / "LOOP-F35.html").read_text(encoding="utf-8")
        self.assertIn('href="cards/hermes-reviewer/hermes-loop-f35/card-hermes-reviewer-request_changes-r1.png"', page)
        self.assertIn('href="cards/hermes-reviewer/hermes-LOOP-F35/card-hermes-reviewer-approve-r2.png"', page)
        self.assertTrue((self.www / "rows" / "cards" / "hermes-reviewer" / "hermes-LOOP-F35").is_symlink())
        self.assertTrue((self.www / "rows" / "cards" / "hermes-reviewer" / "hermes-loop-f35").is_symlink())
        sys.path.insert(0, str(HERE.parent))
        import importlib.util
        spec = importlib.util.spec_from_file_location("rows_board_t", BOARD)
        rb = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(rb)
        cards = rb.scan_cards(str(self.root))
        self.assertNotIn("hermes-loop-f35", cards)
        entry = cards["hermes-LOOP-F35"]["hermes-reviewer"]
        self.assertEqual(sorted(os.path.basename(os.path.dirname(d)) for d in entry["dirs"]), ["hermes-LOOP-F35", "hermes-loop-f35"])
        self.assertEqual([c["file"] for c in entry["cards"]], ["card-hermes-reviewer-approve-r2.png", "card-hermes-reviewer-request_changes-r1.png"])
        self.assertEqual(entry["latest"]["hermes-reviewer"]["thread"], "hermes-LOOP-F35")

    def test_two_spellings_of_one_card_dir_merge_on_any_filesystem(self):
        """scan_cards' merge branch and link_card_dirs' multi-dir loop, in-process: glob / isdir / listdir / getmtime are
        pointed at two REAL directories standing for `hermes-LOOP-F35/cards` and `hermes-loop-f35/cards`, so the case runs
        on a case-folding filesystem too."""
        import glob as _glob
        import importlib.util
        from unittest import mock

        real_upper = Path(self.tmp.name) / "real-upper" / "cards"
        real_lower = Path(self.tmp.name) / "real-lower" / "cards"
        put(real_lower / "card-hermes-reviewer-request_changes-r1.png", b"\x89PNG rc", hours_ago=1.0)
        put(real_lower / "card-hermes-reviewer-latest.png", b"\x89PNG rc", hours_ago=1.0)
        put(real_upper / "card-hermes-reviewer-approve-r2.png", b"\x89PNG ok", hours_ago=0.5)
        put(real_upper / "card-hermes-reviewer-latest.png", b"\x89PNG ok", hours_ago=0.5)
        fake_upper = str(self.root / "groups" / "hermes-reviewer" / "reports" / "hermes-LOOP-F35" / "cards")
        fake_lower = str(self.root / "groups" / "hermes-reviewer" / "reports" / "hermes-loop-f35" / "cards")
        alias = {fake_upper: str(real_upper), fake_lower: str(real_lower)}

        def remap(p):
            for fake, real in alias.items():
                if p == fake or p.startswith(fake + os.sep):
                    return real + p[len(fake):]
            return p

        sys.path.insert(0, str(HERE.parent))
        spec = importlib.util.spec_from_file_location("rows_board_fs", BOARD)
        rb = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(rb)
        real_isdir, real_listdir, real_getmtime = os.path.isdir, os.listdir, os.path.getmtime
        with mock.patch.object(_glob, "glob", return_value=[fake_lower, fake_upper]), \
             mock.patch.object(os.path, "isdir", lambda p: real_isdir(remap(p))), \
             mock.patch.object(os, "listdir", lambda p: real_listdir(remap(p))), \
             mock.patch.object(os.path, "getmtime", lambda p: real_getmtime(remap(p))):
            cards = rb.scan_cards(str(self.root))
        self.assertEqual(list(cards), ["hermes-LOOP-F35"])  # one key, the canonical spelling
        entry = cards["hermes-LOOP-F35"]["hermes-reviewer"]
        self.assertEqual(entry["dirs"], [fake_upper, fake_lower])  # sorted(glob): the upper-case dir first
        self.assertEqual([(c["file"], c["thread"], c["dir"]) for c in entry["cards"]], [
            ("card-hermes-reviewer-approve-r2.png", "hermes-LOOP-F35", fake_upper),
            ("card-hermes-reviewer-request_changes-r1.png", "hermes-loop-f35", fake_lower),
        ])
        lat = entry["latest"]["hermes-reviewer"]
        self.assertEqual((lat["thread"], lat["png"]), ("hermes-LOOP-F35", "card-hermes-reviewer-latest.png"))  # the newer latest wins
        # the older `latest` winning when IT is newer: swap the mtimes
        put(real_lower / "card-hermes-reviewer-latest.png", b"\x89PNG rc", hours_ago=0.1)
        with mock.patch.object(_glob, "glob", return_value=[fake_lower, fake_upper]), \
             mock.patch.object(os.path, "isdir", lambda p: real_isdir(remap(p))), \
             mock.patch.object(os, "listdir", lambda p: real_listdir(remap(p))), \
             mock.patch.object(os.path, "getmtime", lambda p: real_getmtime(remap(p))):
            self.assertEqual(rb.scan_cards(str(self.root))["hermes-LOOP-F35"]["hermes-reviewer"]["latest"]["hermes-reviewer"]["thread"], "hermes-loop-f35")
        # link_card_dirs links every dir of a merged entry under its own name (names that differ on any filesystem here)
        www_rows = Path(self.tmp.name) / "www-rows"
        merged = {"dir": str(real_upper), "thread": "real-upper", "dirs": [str(real_upper), str(real_lower)], "cards": [], "latest": {}}
        rb.link_card_dirs(str(www_rows), {"hermes-LOOP-F35": {"hermes-reviewer": merged}})
        self.assertEqual(os.readlink(www_rows / "cards" / "hermes-reviewer" / "real-upper"), str(real_upper))
        self.assertEqual(os.readlink(www_rows / "cards" / "hermes-reviewer" / "real-lower"), str(real_lower))

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


AGREEMENT_SPEC = {
    "planning_hours": {"BUILD": 48, "CONFIGURE": 15, "ADOPT": 10},
    "stage_factors": {"queued": 1.0, "dispatched": 0.85, "spec_handoff": 0.85, "building": 0.6, "pr_open": 0.35,
                      "testing": 0.35, "review": 0.2, "gate": 0.1, "merged": 0},
    "rungs": [{"id": "R1", "title": "the three fixture rows", "rows": ["LOOP-F35", "MEM-F44", "ISO-F17"]}],
}


class DemoPathPageTest(unittest.TestCase):
    """The demo-path tracker on its own page: /rows/demo-path.html + /rows/demo-path.json, both from the board's
    per-row records (rows-board.load_board → demo_path.rows_from_board); the index has ONE header link to it and
    nothing else changes; every row shows ONE state — the index cell, the row page and the tracker chip agree
    (modulo the cell's `· hold` / `· cost hold` / `· waived` / gate decorations); a broken or missing spec, or a
    failed write, is a banner / log line on the tracker side, the board still writes, the JSON is left as it was,
    exit 0."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name) / "checkout"
        self.www = Path(self.tmp.name) / "www"
        put(self.root / "docs" / "hermes-port" / "dispatch-plan.md", PLAN)
        rows = {"LOOP-F35": {"state": "testing", "disposition": "BUILD", "batch": "1a"},
                "MEM-F44": {"state": "queued", "disposition": "CONFIGURE", "batch": "1b"},
                "ISO-F17": {"state": "queued", "disposition": "ADOPT", "batch": "adopt"}}
        self.ap = self.root / "data" / "shared" / "hermes" / "autopilot"
        put(self.ap / "state.json", json.dumps({
            "generated_at": (NOW_DT - timedelta(minutes=10)).strftime("%Y-%m-%dT%H:%M:%SZ"), "rows": rows,
            "gating": {"1a_first_pass": False}, "wip": {"limit": 3},
            "supervise": {"rows": {"LOOP-F35": {"stage": "building", "hold": None, "cost_hold": False}}},
            "queue": {"eligible": [], "waiting": [{"id": "MEM-F44", "batch": "1b", "blocked_by": ["1a_first_pass"]},
                                                  {"id": "ISO-F17", "batch": "adopt", "blocked_by": ["batch3_merged", "batch4_merged"]}]},
        }))
        put(self.ap / "config.json", json.dumps({"wip": 3, "paused_rows": ["MEM-F44"]}))
        cards = self.root / "groups" / "hermes-tester" / "reports" / "hermes-LOOP-F35" / "cards"
        put(cards / "card-hermes-tester-pass-r1.png", b"\x89PNG r1", hours_ago=5.0)

    def tearDown(self):
        self.tmp.cleanup()

    def render(self, *extra: str, env: dict | None = None) -> subprocess.CompletedProcess:
        proc = board(self.root, self.www, "--ncl", "", *extra, env=env)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        return proc

    def read(self, name: str) -> str:
        return (self.www / "rows" / name).read_text(encoding="utf-8")

    def board_cells(self) -> dict:
        """{row id: stage cell text} parsed from index.html — what every reader of the board sees for the row."""
        index = self.read("index.html")
        return {m.group(1): html.unescape(m.group(2))
                for m in re.finditer(r'<b>([A-Za-z0-9._-]+)</b>(?:</a>)?(?:<span class="badge"[^>]*>[^<]*</span>)?<br>.*?<td class="stage">(.*?)</td>', index)}

    def test_index_has_only_the_link_and_the_tracker_has_its_own_page(self):
        proc = self.render()
        self.assertIn("+ demo-path.html + demo-path.json", proc.stdout)
        index = self.read("index.html")
        self.assertEqual(index.count('<a href="demo-path.html">Demo path →</a>'), 1)
        self.assertLess(index.index("<h1>"), index.index('href="demo-path.html"'))
        self.assertLess(index.index('href="demo-path.html"'), index.index("<h2>Batch 1a"), "the link sits in the header, above the batch tables")
        for needle in ("<h2>Demo path", "dp-row", "ETA model", "<b>R1</b>", "demo path unavailable"):
            self.assertNotIn(needle, index, needle)
        # Nothing else of the board changed: the same sections, stage cell, thumbnail and tables as before.
        self.assertIn('<td class="stage">building</td>', index)
        self.assertIn('<img class="thumb ok" src="cards/hermes-tester/hermes-LOOP-F35/card-hermes-tester-pass-r1.png" width="180"', index)
        self.assertIn("<h2>Carried criteria", index)
        self.assertIn("<h2>Upstream asks", index)
        self.assertIn("1 cards on disk · 1 threads with cards", index)
        # The row pages are untouched by the tracker.
        row = self.read("LOOP-F35.html")
        self.assertIn("stage: <b>building</b>", row)
        self.assertNotIn("Demo path", row)
        # The tracker page: full page, the board's CSS, a link back, the rungs.
        page = self.read("demo-path.html")
        self.assertIn("<title>Demo path</title>", page)
        self.assertIn("<h1>Demo path</h1>", page)
        self.assertIn('<a href="index.html">← rows board</a>', page)
        self.assertLess(page.index("← rows board"), page.index("<h1>"))
        self.assertIn(".thumb{display:block;width:180px", page, "the same stylesheet as the board")
        self.assertIn("<h2>Demo path", page)
        for rid in ("<b>R1</b>", "<b>R2</b>", "<b>R3</b>", "<b>R4</b>", "<b>R5</b>"):
            self.assertIn(rid, page)
        self.assertIn("ETA model", page)
        self.assertIn("in progress", page)
        self.assertIn("LOOP-F35 · building", page)
        self.assertIn("ISO-F17 · waiting", page)
        # Rows the plan does not list are unknown on the tracker, collapsed into one line per reason.
        self.assertIn("not on the rows board (not a plan row): LOOP-F37, GOV-F24", page)

    def test_tracker_uses_the_board_records_not_state_json_rows(self):
        # state.json says LOOP-F35 is `testing`; the supervisor says `building`: the board shows building on the index
        # and the row page, and so does the tracker (the same record). Then the ledger says MERGED while state.json
        # still says testing / building (the supervise tick is 2-hourly, the Orchestrator writes the ledger at merge
        # time): the ONE derivation (rows-board.row_state) reads the ledger first, so the index cell, the row page
        # and the tracker all say merged in the same render, the tracker with the ledger's date.
        self.render()
        self.assertIn("LOOP-F35 · building", self.read("demo-path.html"))
        self.assertIn('<td class="stage">building</td>', self.read("index.html"))
        self.assertIn("stage: <b>building</b>", self.read("LOOP-F35.html"))
        put(self.root / "groups" / "orchestrator" / "reports" / "ledger.md", LEDGER.replace(
            "| PASS | — | autopilot dispatch", "| PASS · APPROVE | MERGED `1e3e63f` (squash) — 2026-09-10 06:35Z — 4/4 AC | autopilot dispatch"))
        self.render()
        page = self.read("demo-path.html")
        self.assertIn("LOOP-F35 · merged", page)
        self.assertIn("merged 2026-09-10", page)
        self.assertIn('<td class="stage">merged</td>', self.read("index.html"), "the board cell follows the ledger too")
        self.assertNotIn('<td class="stage">building</td>', self.read("index.html"))
        self.assertIn("stage: <b>merged</b>", self.read("LOOP-F35.html"))
        data = json.loads(self.read("demo-path.json"))
        r1 = {r["id"]: r for r in data["rungs"]}["R1"]
        f35 = {x["id"]: x for x in r1["rows"]}["LOOP-F35"]
        self.assertEqual((f35["state"], f35["done_at"]), ("merged", "2026-09-10T06:35:00Z"))
        self.assertEqual(data["order_source"], "state.json queue (eligible, then waiting)")

    def test_one_state_per_row_on_the_index_the_row_page_and_the_tracker(self):
        """For every board row, in one render: index stage cell == row-page stage == tracker chip label, modulo
        the cell's decorations — through the cases where the two surfaces used to disagree."""
        spec = self.root / "spec.json"
        put(spec, json.dumps(AGREEMENT_SPEC))
        state = json.loads((self.ap / "state.json").read_text(encoding="utf-8"))
        ledger_dir = self.root / "groups" / "orchestrator" / "reports"

        def check(expect: dict, why: str) -> None:
            self.render("--demo-spec", str(spec))
            cells = self.board_cells()
            data = json.loads(self.read("demo-path.json"))
            rows = {r["id"]: r for r in data["rungs"][0]["rows"]}
            page = self.read("demo-path.html")
            for rid, (cell, label) in expect.items():
                self.assertEqual(cells.get(rid), cell, f"{why}: index cell of {rid}")
                self.assertIn(f"stage: <b>{html.escape(cell)}</b>", self.read(f"{rid}.html"), f"{why}: row page of {rid}")
                self.assertEqual(rows[rid]["label"], label, f"{why}: tracker label of {rid}")
                self.assertIn(f"{rid} · {html.escape(label)}", page, f"{why}: tracker chip of {rid}")
                self.assertIn(f"{rid} {label}", data["slack_text"], f"{why}: Slack line of {rid}")
                self.assertTrue(cell.split(" · ")[0] == label or (label == "waived" and cell.endswith("· waived")), (why, rid, cell, label))

        # As set up: queue testing + supervisor building → building; MEM-F44 paused via config (queued behind 1a on
        # the queue, which the pause outranks); ISO-F17 queued behind two gates → waiting, the gates decorate the cell.
        check({"LOOP-F35": ("building", "building"), "MEM-F44": ("paused", "paused"),
               "ISO-F17": ("waiting · batch3_merged, batch4_merged", "waiting")}, "baseline")
        # (B) the ledger says MERGED while state.json (a tick behind) still says testing / building.
        put(ledger_dir / "ledger.md", LEDGER.replace("| PASS | — | autopilot dispatch", "| PASS · APPROVE | MERGED `1e3e63f` — 2026-09-10 06:35Z | autopilot dispatch"))
        check({"LOOP-F35": ("merged", "merged")}, "ledger merged, state.json stale")
        # (G) + (E) the operator pauses LOOP-F35 and un-pauses / waives MEM-F44 after the tick: config.json is the truth.
        put(ledger_dir / "ledger.md", LEDGER)
        put(self.ap / "config.json", json.dumps({"wip": 3, "paused_rows": ["LOOP-F35"], "waive": ["MEM-F44"]}))
        check({"LOOP-F35": ("paused", "paused"), "MEM-F44": ("waiting · 1a_first_pass · waived", "waived")}, "paused + waived via config")
        # (F) a row parked at gate on a 1a merge hold with a cost card pending: the cell decorates, the label is the state,
        # and the tracker treats it as held (no ETA, flagged) instead of 4.8 h from done.
        put(self.ap / "config.json", json.dumps({"wip": 3}))
        state["supervise"]["rows"]["LOOP-F35"] = {"stage": "gate", "hold": "1a", "cost_hold": True, "target_role": "hermes-architect"}
        state["rows"]["LOOP-F35"]["state"] = "gate"
        # (C) only the queue sees ISO-F17 in flight (dispatch bookkeeping); (D) only the supervisor sees MEM-F44 in flight.
        state["rows"]["ISO-F17"]["state"] = "dispatched"
        state["supervise"]["rows"]["ISO-F17"] = {"stage": "queued"}
        state["supervise"]["rows"]["MEM-F44"] = {"stage": "building"}
        put(self.ap / "state.json", json.dumps(state))
        check({"LOOP-F35": ("gate · hold 1a · cost hold", "gate"), "ISO-F17": ("dispatched", "dispatched"), "MEM-F44": ("building", "building")},
              "holds and one-sided in-flight")
        data = json.loads(self.read("demo-path.json"))
        f35 = {r["id"]: r for r in data["rungs"][0]["rows"]}["LOOP-F35"]
        self.assertEqual((f35["stalled"], f35["eta"], f35["blockers"]), ("held", None, ["held — cost card pending"]))
        self.assertIn("LOOP-F35 held — cost card pending", data["rungs"][0]["blockers"])
        self.assertIn('<span class="dot red"></span>needs input · hold: 1a', self.read("index.html"), "the board's red dot (role_live), untouched")

    def test_demo_json_agrees_with_the_page_and_carries_the_slack_text(self):
        self.render()
        data = json.loads(self.read("demo-path.json"))
        page = self.read("demo-path.html")
        self.assertEqual([r["id"] for r in data["rungs"]], ["R1", "R2", "R3", "R4", "R5"])
        self.assertEqual(data["generated_at"], NOW)
        self.assertTrue(data["state_ok"])
        self.assertEqual(data["wip_limit"], 3)
        self.assertEqual(data["paused_rows"], ["MEM-F44"])
        cells = self.board_cells()
        self.assertEqual(set(cells), {"LOOP-F35", "MEM-F44", "ISO-F17"})
        for rung in data["rungs"]:
            self.assertIn(f'<b>{rung["id"]}</b>', page)
            self.assertIn(html.escape(rung["status_label"]), page)
            for row in rung["rows"]:
                self.assertIn(f'{row["id"]} · {row["label"]}', page, "every row chip on the page is a row in the JSON, same state")
                if row["id"] in cells:   # tracker vs board: the same state as the index cell, minus its decorations
                    self.assertEqual(cells[row["id"]].split(" · ")[0], row["label"], row["id"])
                else:
                    self.assertEqual(row["label"], "unknown", f"{row['id']} has no board record, so no state")
            if rung["eta_date"]:
                self.assertIn(f"<b>{rung['eta_date']}</b>", page)
        self.assertTrue(data["slack_text"].startswith("*Demo path*"))
        self.assertLessEqual(len(data["slack_text"].split("\n")), 25)
        for rid in ("*R1*", "*R5*", "LOOP-F35 building", "ISO-F17 waiting"):
            self.assertIn(rid, data["slack_text"])
        self.assertIn("model_notes", data)
        # Atomic + idempotent: a second run rewrites both, no .tmp left behind.
        self.render()
        self.assertEqual(sorted(p.name for p in (self.www / "rows").glob("demo-path.*")), ["demo-path.html", "demo-path.json"])

    def test_missing_or_broken_spec_is_a_banner_on_the_tracker_page_and_the_json_is_left_alone(self):
        r = self.render("--demo-spec", str(self.root / "nope.json"))
        self.assertIn("(tracker failed; demo-path.json untouched)", r.stdout)
        self.assertIn("rows-board: demo path: FileNotFoundError", r.stderr)
        page = self.read("demo-path.html")
        self.assertIn("demo path unavailable — FileNotFoundError", page)
        self.assertIn("<title>Demo path</title>", page)
        self.assertIn('<a href="index.html">← rows board</a>', page)
        self.assertNotIn("<b>R1</b>", page)
        self.assertFalse((self.www / "rows" / "demo-path.json").exists(), "never written on a failed first run")
        index = self.read("index.html")
        self.assertIn("<h2>Batch 1a", index)
        self.assertIn('<a href="demo-path.html">Demo path →</a>', index)
        self.assertNotIn("demo path unavailable", index, "the failure is on the tracker page, not the board")
        # A good run writes the JSON; a later broken run leaves it exactly as it was (slack-rows sees it age out).
        self.render()
        before = self.read("demo-path.json")
        bad = self.root / "bad.json"
        bad.write_text('{"rungs": []}', encoding="utf-8")
        self.render("--demo-spec", str(bad))
        self.assertIn("demo path unavailable — ValueError: demo-path.json has no rungs", self.read("demo-path.html"))
        self.assertEqual(self.read("demo-path.json"), before)
        # The env var is the same override.
        self.render(env={"DEMO_PATH_SPEC": str(bad)})
        self.assertIn("demo path unavailable", self.read("demo-path.html"))
        self.assertEqual(self.read("demo-path.json"), before)

    def test_a_failed_tracker_write_is_logged_and_the_board_still_writes(self):
        # write_atomic opens <path>.tmp for writing: a directory in its place fails the tracker's write, and nothing
        # else — the index and the row pages are written, no "rows-board failed" page, exit 0.
        (self.www / "rows" / "demo-path.html.tmp").mkdir(parents=True)
        r = self.render()
        self.assertIn("rows-board: demo path: write failed: IsADirectoryError", r.stderr)
        self.assertIn("(tracker failed; demo-path.json untouched)", r.stdout)
        self.assertNotIn("rows-board: failed", r.stderr)
        index = self.read("index.html")
        self.assertIn("<h2>Batch 1a", index)
        self.assertNotIn("rows-board failed", index)
        self.assertIn("stage: <b>building</b>", self.read("LOOP-F35.html"))
        self.assertFalse((self.www / "rows" / "demo-path.json").exists())

    def test_load_board_records_and_demo_tracker_helpers(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location("rows_board_for_demo", BOARD)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        put(self.root / "groups" / "orchestrator" / "reports" / "ledger.md", LEDGER)
        b = mod.load_board(str(self.root), NOW_DT)
        recs = b["records"]
        self.assertEqual(list(recs), ["LOOP-F35", "MEM-F44", "ISO-F17"], "plan order; the card thread is a plan row")
        f35 = recs["LOOP-F35"]
        self.assertEqual((f35["queue_state"], f35["sup_stage"], f35["stage"]), ("testing", "building", "building"))
        # the canonical fields (row_state): the one state every surface renders, its reason, holds, waived, gates
        self.assertEqual((f35["state"], f35["state_reason"], f35["holds"], f35["waived"], f35["paused"], f35["gates"]),
                         ("building", None, [], False, False, ()))
        self.assertEqual((f35["disposition"], f35["batch"], f35["merged_at"]), ("BUILD", "1a", None))
        self.assertEqual(f35["ledger"]["pr"], 7)
        self.assertIsNone(f35["ledger"]["outcome"])
        self.assertIsNone(f35["ledger"]["merged_at"])
        self.assertEqual(f35["latest"]["hermes-tester"]["outcome"], "pass")
        self.assertEqual(set(f35["dots"]), {"hermes-architect", "hermes-builder", "hermes-tester", "hermes-reviewer", "orchestrator"})
        self.assertEqual(f35["row_dot"], "grey")
        mem = recs["MEM-F44"]
        self.assertEqual((mem["state"], mem["state_reason"], mem["stage"]), ("paused", "config.paused_rows", "paused"))
        self.assertEqual(mem["carries_open"], ["AC-LOOP-F35-5"])
        self.assertIsNone(mem["ledger"], "no ledger row")
        iso17 = recs["ISO-F17"]
        self.assertEqual((iso17["state"], iso17["gates"], iso17["stage"]), ("waiting", ("batch3_merged", "batch4_merged"), "waiting · batch3_merged, batch4_merged"))
        self.assertEqual(mod.row_stage(iso17), iso17["stage"], "row_stage is a formatter over the record")
        self.assertEqual(b["config"], {"wip": 3, "paused_rows": ["MEM-F44"]})
        self.assertFalse((self.www / "rows").exists(), "load_board writes nothing")
        # demo_tracker: (result, body, json text) over the board; a broken spec is (None, banner, None) + one log line, never a raise.
        result, body, json_text = mod.demo_tracker(b, NOW_DT)
        self.assertEqual([r["id"] for r in result["rungs"]], ["R1", "R2", "R3", "R4", "R5"])
        self.assertIn("<h2>Demo path", body)
        self.assertIn("slack_text", result)
        self.assertEqual(json.loads(json_text)["slack_text"], result["slack_text"])
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            result, body, json_text = mod.demo_tracker(b, NOW_DT, spec_path=str(self.root / "missing.json"))
        self.assertIsNone(result)
        self.assertIsNone(json_text)
        self.assertIn("demo path unavailable — FileNotFoundError", body)
        self.assertIn("rows-board: demo path: FileNotFoundError", err.getvalue())
        self.assertIn("<title>Demo path</title>", mod.render_demo_page(body, NOW_DT))
