#!/usr/bin/env python3
"""Tests for the `cards 24h N` header token: scorecard.count_recent_cards + the CLI plumbing.
Run: python3 -m unittest ops/nemoclaw-coworkers/autopilot/test_cards_count.py
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
from unittest import mock

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import scorecard

NOW_DT = datetime(2026, 9, 10, 12, 0, tzinfo=timezone.utc)
NOW = "2026-09-10T12:00:00Z"
LEDGER = (
    "| row-id | dispatched | spec accepted | PR | verdict | merged/blocked | notes |\n"
    "| --- | --- | --- | --- | --- | --- | --- |\n"
    "| LOOP-F35 | 2026-09-09 12:20 IST (to hermes-architect) | 2026-09-09 15:27 IST | — | — | — | n |\n"
)


def ago(hours: float) -> str:
    return (NOW_DT - timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%SZ")


def threads_json() -> dict:
    """collect_threads.py's shape with two countable captions: the tester's PNG card 1.9 h ago and the
    builder's HTML fallback 0.5 h ago. The receiver's `in` copy, a 30 h old card, a non-card line
    and a caption with a broken timestamp must not count."""
    def m(hours, text, direction="out"):
        return {"seq": 1, "direction": direction, "kind": None, "timestamp": ago(hours), "sender": "x", "text": text}
    return {
        "generated_at": NOW,
        "sessions_checked": True,
        "threads": {
            "LOOP-F35": {"thread_id": "hermes-LOOP-F35", "sessions": [
                {"id": "s-t", "role": "hermes-tester", "messages": [
                    m(2.0, "[Test Report] slang-coworkers/hermes-agent#7 (round 1/2, head a1b2c3d)\n- **Verdict:** FAIL"),
                    m(1.9, "card · LOOP-F35 · hermes-tester · FAIL — three scenarios red"),
                    m(1.9, "card · LOOP-F35 · hermes-tester · FAIL — three scenarios red", direction="in"),
                    m(30.0, "card · LOOP-F35 · hermes-tester · PASS — yesterday's"),
                ]},
                {"id": "s-b", "role": "hermes-builder", "messages": [
                    m(0.5, "card(html) · LOOP-F35 · hermes-builder · FIXED — PNG render failed"),
                    m(0.4, "cardinal · not a card"),
                    {"direction": "out", "timestamp": "garbage", "text": "card · LOOP-F35 · hermes-builder · FIXED — bad ts"},
                    {"direction": "out", "timestamp": ago(0.1), "text": None},
                ]},
            ]},
            "GOV-F24": {"thread_id": "hermes-GOV-F24", "sessions": [{"id": "s-o", "role": "orchestrator", "messages_error": "x"}]},
        },
    }


def touch(path: Path, hours_ago: float) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"\x89PNG fake")
    ts = (NOW_DT - timedelta(hours=hours_ago)).timestamp()
    os.utime(path, (ts, ts))


class CountRecentCardsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.groups = self.root / "groups"
        cards = self.groups / "hermes-tester" / "reports" / "hermes-LOOP-F35" / "cards"
        touch(cards / "card-hermes-tester-fail-r1.png", 30.0)       # too old
        touch(cards / "card-hermes-tester-fail-r2.png", 2.0)
        touch(cards / "card-hermes-tester-latest.png", 2.0)         # a copy: not counted
        touch(cards / "card-hermes-tester-fail-r2.html", 2.0)       # not a PNG
        touch(self.groups / "hermes-builder" / "reports" / "hermes-LOOP-F35" / "cards" / "card-hermes-builder-fixed-r2.png", 0.5)
        touch(self.groups / "orchestrator" / "reports" / "hermes-GOV-F24" / "cards" / "card-orchestrator-merged-r1.png", 23.9)
        touch(self.groups / "orchestrator" / "reports" / "status" / "card-orchestrator-merged-r1.png", 1.0)   # not a hermes-* thread dir

    def tearDown(self):
        self.tmp.cleanup()

    def test_counts_pngs_under_24h_excluding_latest_copies(self):
        self.assertEqual(scorecard.count_recent_cards([str(self.groups)], NOW_DT), 3)
        self.assertEqual(scorecard.count_recent_cards([str(self.groups)], NOW_DT, hours=1.0), 1)

    def test_one_group_root_and_unknown_when_no_root(self):
        self.assertEqual(scorecard.count_recent_cards([str(self.groups / "hermes-tester")], NOW_DT), 1)
        self.assertIsNone(scorecard.count_recent_cards([str(self.root / "nope")], NOW_DT))
        self.assertIsNone(scorecard.count_recent_cards([], NOW_DT))
        self.assertIsNone(scorecard.count_recent_cards(None, NOW_DT))

    def test_default_roots_from_env_or_layout(self):
        ap_dir = self.root / "data" / "shared" / "hermes" / "autopilot"
        ap_dir.mkdir(parents=True)
        old = os.environ.pop("HERMES_CARDS_ROOT", None)
        try:
            self.assertEqual(scorecard.default_card_roots(str(ap_dir)), [str(self.groups)])
            os.environ["HERMES_CARDS_ROOT"] = f"{self.groups}:{self.root / 'x'}"
            self.assertEqual(scorecard.default_card_roots(str(ap_dir)), [str(self.groups), str(self.root / "x")])
        finally:
            if old is None:
                os.environ.pop("HERMES_CARDS_ROOT", None)
            else:
                os.environ["HERMES_CARDS_ROOT"] = old

    def test_build_and_cli_put_the_count_in_the_header(self):
        ap_dir = self.root / "data" / "shared" / "hermes" / "autopilot"
        ap_dir.mkdir(parents=True)
        (ap_dir / "ledger.md").write_text(LEDGER)
        (ap_dir / "state.json").write_text(json.dumps({"generated_at": NOW, "rows": {}, "in_flight": ["LOOP-F35"], "supervise": {"rows": {}}}))
        card = scorecard.build(str(ap_dir), NOW_DT, None, None, timedelta(hours=5, minutes=30), card_roots=[str(self.groups)])
        self.assertEqual(card["cards_24h"], 3)
        self.assertIn(" · alerts 6h 0 · cards 24h 3", card["abtr_brief"].splitlines()[0])
        self.assertIn(" · cards 24h 3", card["abtr_markdown"].splitlines()[0])
        header = card["abtr_markdown"].splitlines()[0]
        self.assertTrue(header.startswith("Hermes autopilot · 09-10 12:00Z · "), header)
        self.assertLessEqual(len(header), 110)
        # default roots: the checkout layout <dir>/../../../groups is found without a flag
        env = {k: v for k, v in os.environ.items() if k != "HERMES_CARDS_ROOT"}
        proc = subprocess.run([sys.executable, str(HERE / "scorecard.py"), "--dir", str(ap_dir), "--now", NOW, "--brief"],
                              capture_output=True, text=True, env=env, check=False)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn(" · cards 24h 3", proc.stdout.splitlines()[0])
        proc = subprocess.run([sys.executable, str(HERE / "scorecard.py"), "--dir", str(ap_dir), "--now", NOW, "--brief",
                               "--cards-root", str(self.root / "nowhere")], capture_output=True, text=True, env=env, check=False)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn(" · cards 24h ?", proc.stdout.splitlines()[0])   # no reachable card dir: unknown


class ThreadsFallbackTest(unittest.TestCase):
    """Inside the Orchestrator container the only card root is /workspace/agent (its own cards): the
    header's `cards 24h N` must then come from the `card · ` captions on the collected threads."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.ap_dir = self.root / "data" / "shared" / "hermes" / "autopilot"
        self.ap_dir.mkdir(parents=True)
        (self.ap_dir / "ledger.md").write_text(LEDGER)
        (self.ap_dir / "state.json").write_text(json.dumps({"generated_at": NOW, "rows": {}, "in_flight": ["LOOP-F35"], "supervise": {"rows": {}}}))
        (self.ap_dir / "threads.json").write_text(json.dumps(threads_json()))
        self.groups = self.root / "groups"
        touch(self.groups / "hermes-tester" / "reports" / "hermes-LOOP-F35" / "cards" / "card-hermes-tester-fail-r2.png", 2.0)
        touch(self.groups / "hermes-builder" / "reports" / "hermes-LOOP-F35" / "cards" / "card-hermes-builder-fixed-r2.png", 0.5)
        touch(self.groups / "orchestrator" / "reports" / "hermes-GOV-F24" / "cards" / "card-orchestrator-merged-r1.png", 23.9)

    def tearDown(self):
        self.tmp.cleanup()

    def build(self, **kw):
        return scorecard.build(str(self.ap_dir), NOW_DT, None, None, timedelta(hours=5, minutes=30), **kw)

    def test_count_from_threads_json_captions(self):
        self.assertEqual(scorecard.count_recent_cards_from_threads(threads_json(), NOW_DT), 2)
        self.assertEqual(scorecard.count_recent_cards_from_threads(threads_json(), NOW_DT, hours=1.0), 1)
        # unknown, not zero: no file, not an object, no threads block, or the collector never listed sessions
        self.assertIsNone(scorecard.count_recent_cards_from_threads(None, NOW_DT))
        self.assertIsNone(scorecard.count_recent_cards_from_threads([], NOW_DT))
        self.assertIsNone(scorecard.count_recent_cards_from_threads({"generated_at": NOW}, NOW_DT))
        self.assertIsNone(scorecard.count_recent_cards_from_threads({**threads_json(), "sessions_checked": False}, NOW_DT))
        self.assertEqual(scorecard.count_recent_cards_from_threads({"threads": {}}, NOW_DT), 0)
        # hermes_supervise's normalised view (`ts` instead of `timestamp`) is read too
        norm = {"threads": {"X": {"sessions": [{"messages": [{"direction": "out", "ts": ago(1.0), "text": "card · X · hermes-tester · PASS — ok"}]}]}}}
        self.assertEqual(scorecard.count_recent_cards_from_threads(norm, NOW_DT), 1)

    def test_resolvable_roots(self):
        self.assertEqual(scorecard.resolvable_roots([str(self.groups), str(self.root / "nope"), None, ""]), [str(self.groups)])
        self.assertEqual(scorecard.resolvable_roots(None), [])

    def test_build_falls_back_to_threads_json_when_no_card_dir_resolves(self):
        card = self.build(card_roots=[str(self.root / "nowhere")])
        self.assertEqual(card["cards_24h"], 2)
        self.assertIn(" · cards 24h 2", card["abtr_brief"].splitlines()[0])
        self.assertTrue(any("threads.json" in n for n in card["notes"]), card["notes"])
        # the same through the CLI, with the container's --dir layout (no <dir>/../../../../groups here)
        proc = subprocess.run([sys.executable, str(HERE / "scorecard.py"), "--dir", str(self.ap_dir), "--now", NOW, "--brief",
                               "--cards-root", str(self.root / "nowhere")], capture_output=True, text=True, check=False)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertIn(" · cards 24h 2", proc.stdout.splitlines()[0])
        # --threads points the fallback elsewhere
        other = self.root / "elsewhere.json"
        other.write_text(json.dumps({"threads": {}}))
        proc = subprocess.run([sys.executable, str(HERE / "scorecard.py"), "--dir", str(self.ap_dir), "--now", NOW, "--brief",
                               "--cards-root", str(self.root / "nowhere"), "--threads", str(other)], capture_output=True, text=True, check=False)
        self.assertIn(" · cards 24h 0", proc.stdout.splitlines()[0])
        # no threads.json either: still unknown
        (self.ap_dir / "threads.json").unlink()
        card = self.build(card_roots=[str(self.root / "nowhere")])
        self.assertIsNone(card["cards_24h"])
        self.assertIn(" · cards 24h ?", card["abtr_brief"].splitlines()[0])

    def test_build_counts_captions_when_only_workspace_agent_resolves(self):
        # the Orchestrator container: default roots resolve to /workspace/agent alone, which holds one own card
        with mock.patch.object(scorecard, "default_card_roots", return_value=["/workspace/agent"]), \
             mock.patch.object(scorecard, "resolvable_roots", return_value=["/workspace/agent"]), \
             mock.patch.object(scorecard, "count_recent_cards", return_value=1):
            card = self.build()
        self.assertEqual(card["cards_24h"], 2)
        self.assertIn(" · cards 24h 2", card["abtr_markdown"].splitlines()[0])

    def test_build_keeps_the_filesystem_count_when_a_groups_dir_resolves(self):
        card = self.build(card_roots=[str(self.groups)])
        self.assertEqual(card["cards_24h"], 3)   # the PNGs, not the two captions
        self.assertFalse(any("threads.json" in n for n in card["notes"]), card["notes"])


if __name__ == "__main__":
    unittest.main()
