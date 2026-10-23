"""Tests for ab.py's aggregation: pooling, ratios, steps, and the A/A spread."""
import contextlib
import io
import json
import os
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

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

    def test_empty_aa_is_not_zero_noise(self):
        with self.assertRaisesRegex(ValueError, "no comparable measurements"):
            ab.spread_pct([], "base", "base-again")

    def test_render_lists_every_row_with_the_last_over_first_ratio(self):
        text = ab.render(ab.summarize(self.pooled(), ["base", "c1", "c2"]), ["base", "c1", "c2"])
        self.assertIn("1.200", text)
        self.assertEqual(len(text.splitlines()), 2)


class MeasurementTests(unittest.TestCase):
    def run_aa(self, rows, counters="apiCreateGlobalSession", only="api_session_create"):
        def bench(bench, slangc, label, out_dir, corpus, only, samples):
            os.makedirs(out_dir)
            data = rows(label) if callable(rows) else rows
            with open(os.path.join(out_dir, "results.json"), "w") as fh:
                json.dump(data, fh)
            return SimpleNamespace(returncode=0, stdout="", stderr="")

        with tempfile.TemporaryDirectory() as root, patch.object(ab, "run_bench", bench), \
                patch.dict(os.environ, {"SLANG_COMPILE_PERF_DIR": root}), \
                contextlib.redirect_stdout(io.StringIO()):
            output = os.path.join(root, "aa.json")
            try:
                ab.main(["base=slangc", "--aa", "--only", only, "--counters", counters,
                         "--corpus", root, "--rounds", "2", "--json", output])
            except SystemExit:
                self.assertFalse(os.path.exists(output))
                raise
            with open(output) as fh:
                return json.load(fh)

    def test_api_counters_are_measured_when_explicitly_requested(self):
        result = self.run_aa(results("api_session_create", apiCreateGlobalSession=[10, 11, 12]))
        self.assertEqual(result["aa_spread_pct"], 0)
        self.assertEqual(result["summary"][0]["per_label"]["base"]["n"], 6)

    def test_unmatched_counters_cannot_pass_aa(self):
        with self.assertRaisesRegex(SystemExit, "missing measurements.*compileInner"):
            self.run_aa(results("api_session_create", apiCreateGlobalSession=[10]), counters="compileInner")

    def test_partial_counter_coverage_cannot_pass_aa(self):
        with self.assertRaisesRegex(SystemExit, "missing measurements.*apiCreateSession"):
            self.run_aa(results("api_session_create", apiCreateGlobalSession=[10]),
                        counters="apiCreateGlobalSession,apiCreateSession")

    def test_a_missing_workload_cannot_pass_aa(self):
        with self.assertRaisesRegex(SystemExit, "missing measurements.*absent"):
            self.run_aa(results("api_session_create", apiCreateGlobalSession=[10]),
                        only="api_session_create,absent")

    def test_a_missing_round_cannot_hide_behind_prior_samples(self):
        def rows(label):
            return [] if label == "base-again1" else results("api_session_create", apiCreateGlobalSession=[10])
        with self.assertRaisesRegex(SystemExit, "base-again round 1: missing measurements"):
            self.run_aa(rows)

    def test_invalid_samples_do_not_report_zero_spread(self):
        for sample in (0, -1, float("nan"), float("inf")):
            with self.subTest(sample=sample), self.assertRaisesRegex(SystemExit, "invalid samples"):
                self.run_aa(results("api_session_create", apiCreateGlobalSession=[sample]))


if __name__ == "__main__":
    unittest.main()
