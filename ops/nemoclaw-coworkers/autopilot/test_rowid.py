#!/usr/bin/env python3
"""Tests for rowid.py, the one canonical spelling of a `hermes-<ROW>` thread id (the 2026-09-16 ISO-F13
mis-cased thread). Also pins that every heredoc copy (collect-acks.sh, pull-state.sh x2, dispatch-cron.sh) agrees with it.
Run: python3 -m unittest discover -s ops/nemoclaw-coworkers/autopilot -p 'test_*.py'
"""

from __future__ import annotations

import re
import subprocess
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import rowid

CASES = {
    "hermes-iso-f13": "hermes-ISO-F13",
    "hermes-ISO-F13": "hermes-ISO-F13",
    "hermes-Iso-F10.A": "hermes-ISO-F10.a",
    "hermes-ops-f58.a": "hermes-OPS-F58.a",
    "hermes-OPS-F58.a": "hermes-OPS-F58.a",
    "hermes-loop-f35": "hermes-LOOP-F35",
    "hermes-a2a-f21": "hermes-A2A-F21",
    # not row threads: unchanged
    "hermes-status": "hermes-status",
    "hermes-p6-fleet": "hermes-p6-fleet",
    "hermes-P0-LOOP": "hermes-P0-LOOP",
    "hermes-iso-f13-extra": "hermes-iso-f13-extra",
    "hermes-": "hermes-",
    "gh-issue-x": "gh-issue-x",
    "": "",
}


class CanonThread(unittest.TestCase):
    def test_every_case(self):
        for raw, want in CASES.items():
            with self.subTest(raw=raw):
                self.assertEqual(rowid.canon_thread(raw), want)

    def test_none_and_non_strings_pass_through(self):
        self.assertIsNone(rowid.canon_thread(None))
        self.assertEqual(rowid.canon_thread(7), 7)
        self.assertIsNone(rowid.canon_row(None))

    def test_canonical_output_matches_the_strict_grammar(self):
        for raw, want in CASES.items():
            if want.startswith("hermes-") and rowid.canon_thread(raw) != raw or raw in ("hermes-ISO-F13", "hermes-OPS-F58.a"):
                self.assertRegex(want, rowid.THREAD_RE.pattern)
        self.assertEqual(rowid.canon_row("iso-f13"), "ISO-F13")
        self.assertEqual(rowid.canon_row("Iso-F10.A"), "ISO-F10.a")
        self.assertEqual(rowid.canon_row("P0-LOOP"), "P0-LOOP")

    def test_is_miscased_and_row_of(self):
        self.assertTrue(rowid.is_miscased("hermes-iso-f13"))
        self.assertFalse(rowid.is_miscased("hermes-ISO-F13"))
        self.assertFalse(rowid.is_miscased("hermes-status"))
        self.assertFalse(rowid.is_miscased(None))
        self.assertFalse(rowid.is_miscased(""))
        self.assertEqual(rowid.row_of("hermes-iso-f13"), "ISO-F13")
        self.assertEqual(rowid.row_of("hermes-ISO-F10.a"), "ISO-F10.a")
        self.assertIsNone(rowid.row_of("hermes-status"))
        self.assertIsNone(rowid.row_of(None))

    def test_idempotent(self):
        for raw in CASES:
            once = rowid.canon_thread(raw)
            self.assertEqual(rowid.canon_thread(once), once)


class HeredocCopiesAgree(unittest.TestCase):
    """collect-acks.sh, pull-state.sh (two heredocs) and dispatch-cron.sh embed Python via heredoc and cannot import
    rowid.py; each heredoc that reads a thread id carries an inline `canon_thread`. Extract EVERY copy in a file and run
    the same cases through each, so none can drift from the canonical one."""

    def inline_copies(self, script: str, expected: int) -> list[str]:
        text = (HERE / script).read_text(encoding="utf-8")
        found = re.findall(r"\n_LOOSE_RE = .*?\ndef canon_thread\(thread\):.*?\n(?=\S)", text, re.DOTALL)
        self.assertEqual(len(found), expected, f"{script}: expected {expected} inline canon_thread copies, found {len(found)}")
        return found

    def check(self, script: str, expected: int = 1) -> None:
        import json

        for i, code in enumerate(self.inline_copies(script, expected)):
            with self.subTest(script=script, copy=i):
                prog = "import re, json, sys\n" + code + "\nprint(json.dumps({k: canon_thread(k) for k in json.loads(sys.argv[1])}))\n"
                p = subprocess.run([sys.executable, "-c", prog, json.dumps(list(CASES))], capture_output=True, text=True, check=False)
                self.assertEqual(p.returncode, 0, p.stderr)
                self.assertEqual(json.loads(p.stdout), CASES)

    def test_collect_acks_copy(self):
        self.check("collect-acks.sh")

    def test_pull_state_copies(self):
        self.check("pull-state.sh", expected=2)  # the dispatch overlay (step 4) and the sessions-by-thread writer

    def test_dispatch_cron_copy(self):
        self.check("dispatch-cron.sh")


if __name__ == "__main__":
    sys.exit(unittest.main())
