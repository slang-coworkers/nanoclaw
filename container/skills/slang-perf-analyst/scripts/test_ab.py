"""Tests for ab.py's aggregation: pooling, ratios, steps, and the A/A spread."""
import json
import os
import tempfile
import unittest

import ab


def results(workload, **timers):
    return [{"workload": workload, "ok": True,
             "timers": {t: {"samples": s} for t, s in timers.items()}}]


class PoolingTests(unittest.TestCase):
    def test_samples_are_pooled_across_rounds_and_failed_rows_skipped(self):
        pooled = {}
        for samples in ([10.0, 11.0], [12.0]):
            with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
                json.dump(results("w", compileInner=samples) + [{"workload": "bad", "ok": False}], fh)
            ab.collect(fh.name, ["compileInner", "absent"], pooled)
            os.unlink(fh.name)
        self.assertEqual(pooled, {("w", "compileInner"): [10.0, 11.0, 12.0]})


class SummaryTests(unittest.TestCase):
    def pooled(self):
        return {"base": {("w", "c"): [10.0, 10.0, 10.0]},
                "c1": {("w", "c"): [10.0, 10.0, 10.0]},
                "c2": {("w", "c"): [12.0, 12.0, 12.0]}}

    def test_a_regression_is_a_step_at_one_commit(self):
        row = ab.summarize(self.pooled(), ["base", "c1", "c2"])[0]
        self.assertAlmostEqual(row["steps"]["c1"], 1.0)
        self.assertAlmostEqual(row["steps"]["c2"], 1.2)
        self.assertAlmostEqual(row["ratios"]["c2"], 1.2)

    def test_a_key_missing_for_one_build_is_dropped_not_compared(self):
        pooled = self.pooled()
        del pooled["c1"][("w", "c")]
        self.assertEqual(ab.summarize(pooled, ["base", "c1", "c2"]), [])

    def test_aa_spread_is_the_largest_difference_between_identical_runs(self):
        pooled = {"base": {("w", "a"): [10.0], ("w", "b"): [20.0]},
                  "base-again": {("w", "a"): [10.3], ("w", "b"): [19.0]}}
        summary = ab.summarize(pooled, ["base", "base-again"])
        self.assertAlmostEqual(ab.spread_pct(summary, "base", "base-again"), 5.0, places=1)

    def test_render_lists_every_row_with_the_last_over_first_ratio(self):
        text = ab.render(ab.summarize(self.pooled(), ["base", "c1", "c2"]), ["base", "c1", "c2"])
        self.assertIn("1.200", text)
        self.assertEqual(len(text.splitlines()), 2)


if __name__ == "__main__":
    unittest.main()
