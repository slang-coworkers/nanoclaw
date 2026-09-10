#!/usr/bin/env python3
"""Fixture-driven tests for ops/nemoclaw-coworkers/rows-board.py: a temp checkout with a small
dispatch-plan.md, one fake card set on hermes-LOOP-F35 and a state.json; the board must render
index.html and <ROW>.html, symlink the card dir, and exit 0 on an empty root too.
Run: python3 -m unittest ops/nemoclaw-coworkers/autopilot/test_rows_board.py
"""

from __future__ import annotations

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
