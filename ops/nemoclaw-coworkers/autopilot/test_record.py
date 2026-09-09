#!/usr/bin/env python3
"""Tests for record.py: atomic bookkeeping + newest-first alerts.md insertion."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = str(Path(__file__).resolve().parent / "record.py")


class RecordTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.file = self.dir / "nudges.json"
        self.alerts = self.dir / "alerts.md"

    def tearDown(self):
        self.tmp.cleanup()

    def rec(self, *args, expect=0):
        proc = subprocess.run(
            [sys.executable, SCRIPT, *args, "--file", str(self.file), "--alerts-md", str(self.alerts)],
            capture_output=True, text=True, check=False,
        )
        self.assertEqual(proc.returncode, expect, proc.stderr)
        return proc

    def test_nudged_creates_file_and_appends(self):
        self.rec("nudged", "--row", "LOOP-F35", "--role", "hermes-architect", "--state", "spec_handoff",
                 "--text", "Supervisor nudge LOOP-F35: ...", "--now", "2026-09-09T12:00:00Z")
        self.rec("nudged", "--row", "MEM-F44", "--role", "hermes-builder", "--text", "x", "--now", "2026-09-09T13:00:00Z")
        data = json.loads(self.file.read_text())
        self.assertEqual([n["row"] for n in data["nudges"]], ["LOOP-F35", "MEM-F44"])
        self.assertEqual(data["nudges"][0]["at"], "2026-09-09T12:00:00Z")
        self.assertEqual(data["nudges"][0]["state"], "spec_handoff")
        for key in ("alerts", "dispatched", "redispatched", "round3"):
            self.assertEqual(data[key], [])

    def test_nudged_requires_role_and_text(self):
        self.rec("nudged", "--row", "LOOP-F35", expect=2)

    def test_alert_inserts_newest_first_under_header(self):
        self.rec("alerted", "--row", "LOOP-F35", "--reason", "spec_handoff",
                 "--line", "- 2026-09-09T12:00:00Z · LOOP-F35 · spec_handoff 7h · first", "--now", "2026-09-09T12:00:00Z")
        self.rec("alerted", "--row", "MEM-F44", "--reason", "building",
                 "--line", "- 2026-09-09T18:00:00Z · MEM-F44 · building 17h · second", "--now", "2026-09-09T18:00:00Z")
        text = self.alerts.read_text()
        lines = [l for l in text.split("\n") if l.startswith("- ")]
        self.assertEqual(lines[0].split(" · ")[1], "MEM-F44", "newest first")
        self.assertEqual(lines[1].split(" · ")[1], "LOOP-F35")
        self.assertTrue(text.startswith("# Hermes autopilot alerts"))
        data = json.loads(self.file.read_text())
        self.assertEqual(len(data["alerts"]), 2)
        self.assertEqual(data["alerts"][1]["reason"], "building")

    def test_alert_respects_existing_header_and_lines(self):
        self.alerts.write_text("# custom header\n\nprose line\n\n- 2026-09-08T00:00:00Z · OLD · blocked · old line\n")
        self.rec("alerted", "--row", "NEW-F01", "--line", "- 2026-09-09T00:00:00Z · NEW-F01 · x")
        text = self.alerts.read_text()
        self.assertTrue(text.startswith("# custom header\n\nprose line\n\n- 2026-09-09T00:00:00Z · NEW-F01 · x\n- 2026-09-08"))
        self.assertIn("old line", text, "existing lines are never removed")

    def test_dispatched_and_round3(self):
        self.rec("dispatched", "--row", "MEM-F44", "--batch", "1b", "--now", "2026-09-09T12:00:00Z")
        self.rec("round3", "--row", "LOOP-F35", "--reason", "environmental: install_packages", "--now", "2026-09-09T12:00:00Z")
        self.rec("redispatched", "--row", "LOOP-F35", "--role", "hermes-builder", "--stage", "building")
        data = json.loads(self.file.read_text())
        self.assertEqual(data["dispatched"][0]["batch"], "1b")
        self.assertEqual(data["round3"][0]["reason"], "environmental: install_packages")
        self.assertEqual(data["redispatched"][0]["stage"], "building")

    def test_corrupt_file_refuses_rather_than_overwrites(self):
        self.file.write_text("{not json")
        proc = self.rec("dispatched", "--row", "X-F01", expect=1)
        self.assertIn("not JSON", proc.stderr)
        self.assertEqual(self.file.read_text(), "{not json")


if __name__ == "__main__":
    unittest.main()
