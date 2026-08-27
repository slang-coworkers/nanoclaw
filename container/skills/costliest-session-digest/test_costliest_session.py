"""Tests for the costliest-session-digest tool embedded in SKILL.md.

The tool is EXTRACTED from SKILL.md (the largest ```python block) rather than
imported from a materialised copy, because SKILL.md is the source of truth -- the
container writes /workspace/agent/tools/costliest_session.py from it on every run,
so the two would otherwise drift.

Covers the deterministic parts a digest agent must be able to trust:
  * pricing parity with dashboard/session-costs.ts (opus/sonnet/haiku, TTL-split
    cache writes, unpriced model -> 0)
  * normalize_model on the wire forms seen in prod transcripts
  * iso_day_key + the day filter (only the scored day counts)
  * dedup by message.id (a replayed assistant message must not double-count)
  * ranking picks the costliest session
  * the gate one-liner shape (wakeAgent true above the floor, false below)
  * driver detection (cache-write churn, cache-read bloat, oversized tool output)

Run: python3 test_costliest_session.py
"""
import importlib.util
import json
import os
import re
import tempfile
import types
import unittest
from datetime import datetime, timezone
from pathlib import Path

SKILL = Path(__file__).resolve().parent / "SKILL.md"


def load_tool():
    """Materialise the largest ```python block from SKILL.md as a module."""
    text = SKILL.read_text(encoding="utf-8")
    blocks = re.findall(r"```python\n(.*?)```", text, re.DOTALL)
    if not blocks:
        raise AssertionError("no ```python block found in SKILL.md")
    src = max(blocks, key=len)
    tmp = Path(tempfile.mkdtemp()) / "costliest_session.py"
    tmp.write_text(src, encoding="utf-8")
    spec = importlib.util.spec_from_file_location("costliest_session", tmp)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert isinstance(mod, types.ModuleType)
    return mod


T = load_tool()
TODAY = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
TODAY_KEY = datetime.now(timezone.utc).strftime("%Y%m%d")


def write_jsonl(dirpath, name, rows):
    p = Path(dirpath) / name
    with open(p, "w", encoding="utf-8") as fh:
        fh.writelines(json.dumps(r) + "\n" for r in rows)
    return p


def asst(mid, model, usage, ts=TODAY, content=None):
    msg = {"id": mid, "model": model, "usage": usage}
    if content is not None:
        msg["content"] = content
    return {"type": "assistant", "timestamp": ts, "message": msg}


class Pricing(unittest.TestCase):
    def test_opus_flat_cache(self):
        u = {"input_tokens": 1000, "output_tokens": 1000, "cache_read_input_tokens": 1000,
             "cache_creation_input_tokens": 1000}
        # 1000*5e-6 + 1000*25e-6 + 1000*5e-7 + 1000*6.25e-6
        self.assertAlmostEqual(T.price_usage("claude-opus-5", u), 0.03675, places=6)

    def test_ttl_split_1h_is_2x_input(self):
        u = {"cache_creation": {"ephemeral_1h_input_tokens": 1000, "ephemeral_5m_input_tokens": 1000}}
        # 1000*(5e-6*2) + 1000*6.25e-6
        self.assertAlmostEqual(T.price_usage("claude-opus-5", u), 0.01625, places=6)

    def test_sonnet_and_haiku_differ(self):
        u = {"input_tokens": 1000}
        self.assertAlmostEqual(T.price_usage("claude-sonnet-5", u), 0.002, places=6)
        self.assertAlmostEqual(T.price_usage("claude-haiku-4-5", u), 0.001, places=6)

    def test_unknown_model_is_zero(self):
        self.assertEqual(T.price_usage("gpt-4o", {"input_tokens": 10_000}), 0.0)


class Normalize(unittest.TestCase):
    def test_wire_forms(self):
        self.assertEqual(T.normalize_model("aws/anthropic/bedrock-claude-opus-5"), "claude-opus-5")
        self.assertEqual(T.normalize_model("claude-opus-4-8[1m]"), "claude-opus-4-8")
        self.assertEqual(T.normalize_model("anthropic/claude-haiku-4-5-v1"), "claude-haiku-4-5")
        self.assertEqual(T.normalize_model("claude-sonnet-5-20251001"), "claude-sonnet-5")
        self.assertEqual(T.normalize_model("<synthetic>"), "")
        self.assertEqual(T.normalize_model(None), "")


class DayKey(unittest.TestCase):
    def test_iso_day_key(self):
        self.assertEqual(T.iso_day_key("2026-08-13T04:05:06.789Z"), "20260813")
        self.assertIsNone(T.iso_day_key("garbage"))
        self.assertIsNone(T.iso_day_key(None))

    def test_resolve_day(self):
        self.assertEqual(T.resolve_day("2026-08-13"), "20260813")
        self.assertEqual(T.resolve_day("today"), TODAY_KEY)


class ScanAndRank(unittest.TestCase):
    def test_dedup_by_message_id(self):
        with tempfile.TemporaryDirectory() as d:
            usage = {"input_tokens": 1000, "output_tokens": 1000}
            # same message.id three times (resume replay) must count ONCE
            p = write_jsonl(d, "s.jsonl", [
                asst("m1", "claude-opus-5", usage),
                asst("m1", "claude-opus-5", usage),
                asst("m1", "claude-opus-5", usage),
            ])
            agg = T.scan_file(str(p), TODAY_KEY)
            self.assertEqual(agg["turns"], 1)
            self.assertAlmostEqual(agg["cost"], 0.03, places=6)  # 1000*5e-6 + 1000*25e-6

    def test_day_filter_excludes_other_days(self):
        with tempfile.TemporaryDirectory() as d:
            usage = {"input_tokens": 1000, "output_tokens": 1000}
            p = write_jsonl(d, "s.jsonl", [
                asst("today", "claude-opus-5", usage),
                asst("old", "claude-opus-5", usage, ts="2000-01-01T00:00:00.000Z"),
            ])
            agg = T.scan_file(str(p), TODAY_KEY)
            self.assertEqual(agg["turns"], 1)

    def test_rank_and_gate(self):
        with tempfile.TemporaryDirectory() as d:
            write_jsonl(d, "cheap.jsonl", [
                asst("c1", "claude-sonnet-5", {"input_tokens": 1000}),
            ])
            write_jsonl(d, "pricey.jsonl", [
                asst("p1", "claude-opus-5",
                     {"output_tokens": 200_000, "cache_read_input_tokens": 1_000_000}),
            ])
            os.environ["COSTLIEST_JSONL_DIR"] = d
            rows = T.rank_sessions(TODAY_KEY)
            self.assertEqual(rows[0]["session"], "pricey")
            self.assertGreater(rows[0]["cost"], 1.0)
            self.assertGreater(rows[0]["cost"], rows[1]["cost"])


class GateShape(unittest.TestCase):
    def _gate_json(self, rows, min_usd):
        import contextlib
        import io
        buf = io.StringIO()
        day_total = sum(a["cost"] for a in rows)
        with contextlib.redirect_stdout(buf):
            T.cmd_gate(rows, day_total, TODAY_KEY, None, min_usd)
        return json.loads(buf.getvalue().strip())

    def test_wake_true_above_floor_false_below(self):
        with tempfile.TemporaryDirectory() as d:
            write_jsonl(d, "pricey.jsonl", [
                asst("p1", "claude-opus-5",
                     {"output_tokens": 200_000, "cache_read_input_tokens": 1_000_000}),
            ])
            os.environ["COSTLIEST_JSONL_DIR"] = d
            rows = T.rank_sessions(TODAY_KEY)
            hi = self._gate_json(rows, 1.0)
            self.assertTrue(hi["wakeAgent"])
            self.assertEqual(hi["data"]["top_session"], "pricey")
            lo = self._gate_json(rows, 10_000.0)
            self.assertFalse(lo["wakeAgent"])
            self.assertNotIn("data", lo)

    def test_empty_is_asleep(self):
        with tempfile.TemporaryDirectory() as d:
            os.environ["COSTLIEST_JSONL_DIR"] = d
            rows = T.rank_sessions(TODAY_KEY)
            out = self._gate_json(rows, 1.0)
            self.assertFalse(out["wakeAgent"])


class Drivers(unittest.TestCase):
    def test_cache_write_churn_flagged(self):
        with tempfile.TemporaryDirectory() as d:
            p = write_jsonl(d, "s.jsonl", [
                asst("a", "claude-opus-5",
                     {"input_tokens": 1000, "output_tokens": 1000,
                      "cache_creation": {"ephemeral_1h_input_tokens": 500_000}}),
            ])
            agg = T.scan_file(str(p), TODAY_KEY)
            d2 = T.drivers(agg, agg["cost"])
            joined = " ".join(d2["suggestions"]).lower()
            self.assertIn("cache-write churn", joined)
            self.assertGreater(d2["cache_write_1h_share_pct"], 90)

    def test_cache_read_bloat_flagged(self):
        with tempfile.TemporaryDirectory() as d:
            p = write_jsonl(d, "s.jsonl", [
                asst("a", "claude-opus-5",
                     {"output_tokens": 2000, "cache_read_input_tokens": 800_000}),
            ])
            agg = T.scan_file(str(p), TODAY_KEY)
            self.assertGreaterEqual(agg["peak_context"], 800_000)
            d2 = T.drivers(agg, agg["cost"])
            self.assertIn("cache-read", " ".join(d2["suggestions"]).lower())

    def test_oversized_tool_output_flagged(self):
        with tempfile.TemporaryDirectory() as d:
            big = "x" * 150_000
            p = write_jsonl(d, "s.jsonl", [
                asst("a", "claude-opus-5", {"input_tokens": 1000, "output_tokens": 1000}),
                {"type": "user", "timestamp": TODAY, "message": {
                    "content": [{"type": "tool_result", "tool_use_id": "t1", "content": big}]}},
            ])
            agg = T.scan_file(str(p), TODAY_KEY)
            self.assertGreaterEqual(agg["max_tool_output_chars"], 150_000)
            d2 = T.drivers(agg, agg["cost"])
            self.assertIn("oversized tool outputs", " ".join(d2["suggestions"]).lower())


if __name__ == "__main__":
    unittest.main(verbosity=2)
