"""Test the nightly alert triage: evidence for flagged counters, cross-workload
shifts judged against a night-to-night null, provenance, and full commit-range endpoints.

Fixtures are synthetic; nothing here touches the network or a git checkout.

These tests drive the real perf suite (bench, confirm, lib.analyze), because the
point of triage.py is to agree with the suite about what "flagged" and "comparable"
mean. They need a slang checkout: set SLANG_COMPILE_PERF_DIR to its
tools/compile-perf. The workflow's first step runs them as a contract check, so
interface drift in the suite fails loudly instead of producing wrong numbers.
"""
import contextlib
import io
import json
import os
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

SUITE = os.environ.get("SLANG_COMPILE_PERF_DIR")
if not SUITE:
    raise unittest.SkipTest("SLANG_COMPILE_PERF_DIR is not set (needs a slang checkout)")
sys.path.insert(0, SUITE)  # bench, confirm and lib.analyze come from the slang checkout
HERE = os.path.dirname(os.path.abspath(__file__))

import bench

# bench.py puts the suite's own directory first on sys.path when it is imported, so the skill's
# directory goes first again here: a module of the same name in the suite must never shadow the
# skill's own triage.py.
sys.path.insert(0, HERE)
import triage


class GateContractTests(unittest.TestCase):
    def test_confirmation_reporter_emits_the_gates_regression_annotation(self):
        trend = triage.confirm.trend
        limits = SimpleNamespace(rel=1.1, warn_rel=1.05, abs=2.0, no_fail=False)
        change = trend.MetricChange("w", "compileInner", 100, 120)
        output = io.StringIO()
        with patch.dict(os.environ, {"GITHUB_ACTIONS": "true", "GITHUB_OUTPUT": "",
                                     "GITHUB_STEP_SUMMARY": ""}), contextlib.redirect_stdout(output), \
                self.assertRaises(SystemExit) as stopped:
            trend.report_changes(limits, "night", "runner", "base", 7, [change], [], 1)
        self.assertEqual(stopped.exception.code, trend.EXIT_REGRESSION)
        self.assertIn("::error title=Perf regressions w/compileInner::", output.getvalue())


def row(workload, size=64, sampling="interleaved", **timers):
    """A valid five-sample record; each keyword is a timer's five samples."""
    return {"workload": workload, "size": size, "ok": True, "samples": 5, "warmup": 1,
            "bucket": "test", "sampling_strategy": sampling, "timer_schema": "detailed",
            "timers": {name: bench.stats(vals) for name, vals in timers.items()}}


def around(center, spread=0.01):
    """Five samples centred on `center`, spread by +-`spread` (relative)."""
    return [center * (1 + spread * k) for k in (-1, -0.5, 0, 0.5, 1)]


def night(scale=1.0, workloads=8, timers=None, spread=0.01):
    """{workload: row} for one night; `scale` maps timer name to a multiplier."""
    timers = timers or {"readSerializedModuleAST": 20.0, "compileInner": 200.0}
    out = {}
    for i in range(workloads):
        wl = f"wl{i}"
        out[wl] = row(wl, **{t: around(v * (scale.get(t, 1.0) if isinstance(scale, dict) else scale),
                                       spread)
                             for t, v in timers.items()})
    return out


class ShiftTableTests(unittest.TestCase):
    def baseline(self, noisy_night=1.0):
        nights = {f"2026-01-0{i}-aaaa{i}": night() for i in range(1, 7)}
        if noisy_night != 1.0:
            nights["2026-01-03-aaaa3"] = night(noisy_night)
        return nights

    def shifted(self, table, timer):
        return next(t for t in table if t["timer"] == timer)

    def test_a_fixed_cost_in_one_timer_is_a_shift_and_its_neighbour_is_not(self):
        table = triage.shift_table(night({"readSerializedModuleAST": 1.08}), self.baseline())
        self.assertTrue(self.shifted(table, "readSerializedModuleAST")["significant"])
        self.assertFalse(self.shifted(table, "compileInner")["significant"])
        self.assertAlmostEqual(self.shifted(table, "readSerializedModuleAST")["median_ratio"], 1.08, 2)

    def test_movement_the_baseline_already_shows_is_not_a_shift(self):
        # One baseline night is uniformly 4% slow, so a 4.2% rise tonight is
        # inside ordinary night-to-night movement and must not be reported.
        table = triage.shift_table(night(1.042), self.baseline(noisy_night=1.04))
        self.assertFalse(self.shifted(table, "compileInner")["significant"])
        # Eight percent clears that same null.
        table = triage.shift_table(night(1.08), self.baseline(noisy_night=1.04))
        self.assertTrue(self.shifted(table, "compileInner")["significant"])

    def test_a_shift_confined_to_a_few_workloads_is_not_global(self):
        tonight = night()
        for wl in ("wl0", "wl1"):
            tonight[wl] = row(wl, readSerializedModuleAST=around(30.0), compileInner=around(200.0))
        table = triage.shift_table(tonight, self.baseline())
        self.assertFalse(self.shifted(table, "readSerializedModuleAST")["significant"])

    def test_tiny_timers_are_ignored(self):
        small = {"tinyTimer": 0.5}
        base = {f"2026-01-0{i}-aaaa{i}": night(timers=small) for i in range(1, 7)}
        self.assertEqual(triage.shift_table(night(1.5, timers=small), base), [])

    def test_a_baseline_night_with_other_provenance_is_not_compared(self):
        base = self.baseline()
        other = night()
        for wl in other:
            other[wl]["size"] = 128
        base["2026-01-03-aaaa3"] = other
        hist = []
        tonight = night({"compileInner": 1.5})
        for wl, cur in tonight.items():
            hist += [b[wl] for b in base.values() if triage.comparable(b[wl], cur)]
        self.assertEqual(len(hist), 5 * len(tonight))  # six nights, one excluded


class CounterHintTests(unittest.TestCase):
    def evidence(self, history, original, rerun=None, key_flaky=None, counter="c"):
        base_rows = [row("w", **{counter: h}) for h in history]
        return triage.counter_evidence("w", counter, row("w", **{counter: original}),
                                       row("w", **{counter: rerun}) if rerun else None,
                                       base_rows, key_flaky or {})

    def stable(self, n=6):
        return [around(20.0, 0.01)] * n

    def test_a_slower_median_with_unchanged_best_samples_is_tail_only(self):
        ev = self.evidence(self.stable(), [20.0, 20.1, 24.0, 25.0, 26.0])
        self.assertEqual(ev["hint"], "tail-only")

    def test_every_sample_slower_is_min_shifted(self):
        ev = self.evidence(self.stable(), around(22.0), around(22.2))
        self.assertEqual(ev["hint"], "min-shifted")

    def test_history_that_already_contains_slow_samples_is_bimodal(self):
        history = [[20.0, 20.1, 20.2, 31.0, 31.5]] * 3 + [around(20.0)] * 3
        ev = self.evidence(history, [31.0, 31.2, 31.5, 31.7, 32.0], [31.7, 31.8, 32.0, 32.5, 33.0])
        self.assertEqual(ev["hint"], "bimodal-history")
        self.assertIn("3 of 6", ev["hint_detail"])

    def test_the_registry_wins_and_carries_its_reason(self):
        ev = self.evidence(self.stable(), around(22.0), key_flaky={"w|c": "known bimodal"})
        self.assertEqual((ev["hint"], ev["hint_detail"]), ("known-flaky", "known bimodal"))

    def test_too_little_history_is_stated_not_guessed(self):
        ev = self.evidence(self.stable(2), around(22.0))
        self.assertEqual(ev["hint"], "insufficient-history")


class PolicyTests(unittest.TestCase):
    POLICY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "PERF_POLICY.json")

    def test_the_bundled_policy_is_valid_and_starts_in_shadow_mode(self):
        policy = triage.load_policy(self.POLICY)
        self.assertEqual(policy["mode"], "shadow")
        self.assertEqual(set(policy["classes"]), {"accidental", "avoidable-overhead", "inherent", "unclear"})
        self.assertEqual(policy["mode"] in policy["mode_values"], True)
        # Only classes where the cost is a defect may file; the others never do.
        filing = {c for c, v in policy["classes"].items() if v["file"]}
        self.assertEqual(filing, {"accidental", "avoidable-overhead"})

    def test_the_bundled_policy_never_pings_people_or_triggers_a_fix(self):
        filing = triage.load_policy(self.POLICY)["filing"]
        self.assertFalse(filing["mention_people"])
        self.assertFalse(filing["mention_bot_for_fix"])
        self.assertIsNone(filing["assign"])
        self.assertEqual(filing["max_issues_per_night"], 1)

    def test_known_flaky_comes_from_the_policy_and_an_absent_file_is_empty(self):
        flaky = triage.known_flaky_of(triage.load_policy(self.POLICY))
        self.assertIn("api_module_graph|apiGetCode", flaky)
        self.assertEqual(triage.load_policy("/nonexistent/PERF_POLICY.json"), {})
        self.assertEqual(triage.known_flaky_of({}), {})


class BucketSummaryTests(unittest.TestCase):
    def rows(self, inner_scale, bucket="real_world"):
        out = {}
        for wl in ("a", "b"):
            r = row(wl, compileInner=around(100.0 * inner_scale), frontEndExecute=around(30.0 * inner_scale),
                    SemanticChecking=around(25.0 * inner_scale))
            r["bucket"] = bucket
            r["wall_ms"] = bench.stats(around(120.0 * inner_scale))
            out[wl] = r
        return out

    def test_whole_compile_ratio_and_phase_share_for_real_workloads(self):
        base = {f"2026-01-0{i}-x{i}": self.rows(1.0) for i in range(1, 7)}
        buckets, detail = triage.bucket_summary(self.rows(1.05), base)
        self.assertEqual([b["bucket"] for b in buckets], ["real_world"])
        self.assertAlmostEqual(buckets[0]["compileInner_median_ratio"], 1.05, 3)
        self.assertAlmostEqual(buckets[0]["wall_median_ratio"], 1.05, 3)
        self.assertAlmostEqual(detail[0]["SemanticChecking_share_of_compile"], 0.25, 3)
        self.assertAlmostEqual(detail[0]["frontEndExecute_share_of_compile"], 0.30, 3)

    def test_other_buckets_are_summarized_but_not_listed_as_real_world(self):
        base = {f"2026-01-0{i}-x{i}": self.rows(1.0, "sema") for i in range(1, 7)}
        buckets, detail = triage.bucket_summary(self.rows(1.0, "sema"), base)
        self.assertEqual([b["bucket"] for b in buckets], ["sema"])
        self.assertEqual(detail, [])


class RangeTests(unittest.TestCase):
    def points(self, *spec):
        return {label: {"label": label, "date": label[:10], "commit": commit}
                for label, commit in spec}

    def test_the_base_is_the_newest_night_built_from_another_commit(self):
        pts = self.points(("2026-01-01-a", "aaaa"), ("2026-01-02-b", "bbbb"),
                          ("2026-01-03-b", "bbbb"), ("2026-01-04-c", "cccc"))
        base = triage.resolve_range(pts, pts["2026-01-04-c"], list(pts)[:3])
        self.assertEqual(base["commit"], "bbbb")
        # A short label suffix matches a full SHA recorded in meta.
        pts["2026-01-04-c"]["commit"] = "bbbb0000ffff"
        self.assertEqual(triage.resolve_range(pts, pts["2026-01-04-c"], list(pts)[:3])["commit"], "aaaa")

    def test_a_night_built_from_the_same_commit_has_no_range(self):
        pts = self.points(("2026-01-01-a", "aaaa"), ("2026-01-02-a", "aaaa"), ("2026-01-03-a", "aaaa"))
        self.assertIsNone(triage.resolve_range(pts, pts["2026-01-03-a"], list(pts)[:2]))


class BundleTests(unittest.TestCase):
    """The whole path on a small staged results tree."""

    LABELS = tuple(f"2026-01-0{i}-sha{i}" for i in range(1, 8))

    def write_tree(self, root, candidate=True, confirmation=True, same_commit=False):
        for i, label in enumerate(self.LABELS):
            d = os.path.join(root, "daily", label)
            os.makedirs(d)
            last = i == len(self.LABELS) - 1
            scale = {"readSerializedModuleAST": 1.08} if last else {}
            rows = list(night(scale).values())
            commit = "sha1" if same_commit else f"sha{i + 1}"
            self.dump(d, "results.json", rows)
            self.dump(d, "meta.json", {"date": label[:10], "commit": commit,
                                       "runner": "r", "commit_time": ""})
            if last and confirmation:
                orig = rows[0]["timers"]["readSerializedModuleAST"]
                change = {"workload": "wl0", "counter": "readSerializedModuleAST",
                          "baseline": 20.0, "value": orig["median"]}
                plan = {"label": label, "runner": "r", "notes": [], "judged_count": 1,
                        "thresholds": {"rel": 1.10, "warn_rel": 1.05, "abs": 2.0},
                        "baseline_labels": self.LABELS[:-1],
                        "regressions": [], "warnings": [change] if candidate else []}
                # 22.4 ms clears the alert's 2 ms absolute floor over the 20 ms baseline.
                rerun = [row("wl0", readSerializedModuleAST=around(22.4))]
                self.dump(d, "confirmation.json", {"label": label, "status": "complete",
                                                   "repeated": rerun, "plan": plan})

    @staticmethod
    def dump(directory, name, data):
        with open(os.path.join(directory, name), "w", encoding="utf-8") as fh:
            json.dump(data, fh)

    def bundle(self, **kw):
        with tempfile.TemporaryDirectory() as root:
            self.write_tree(root, **{k: v for k, v in kw.items() if k in
                                     ("candidate", "confirmation", "same_commit")})
            return triage.build_bundle(root, label=self.LABELS[-1], policy=kw.get("policy"))

    def test_a_confirmed_shift_supplies_evidence_and_full_bisect_endpoints(self):
        b = self.bundle()
        self.assertTrue(b["has_candidates"])
        self.assertEqual([(f["counter"], f["outcome"]) for f in b["flagged"]],
                         [("readSerializedModuleAST", "warning")])
        self.assertEqual([t["timer"] for t in b["global_shifts"]], ["readSerializedModuleAST"])
        self.assertEqual(b["commit_range"]["base_commit"], "sha6")
        # Endpoints come from the archived metadata; no commit is preselected.
        self.assertEqual(b["bisect_points"], ["sha6", "sha7"])

    def test_triage_is_offline_and_does_not_preselect_prs(self):
        with patch("subprocess.run", side_effect=AssertionError("triage must use staged files only")):
            b = self.bundle(policy={"policy_version": "test-policy"})
        self.assertEqual(b["policy_version"], "test-policy")
        self.assertEqual(b["schema"], 3)
        for field in ("intent", "candidates", "commits", "evidence_files"):
            self.assertNotIn(field, b)
        self.assertEqual(b["bisect_points"], ["sha6", "sha7"])

    def test_api_only_shift_keeps_the_full_bisect_range(self):
        with tempfile.TemporaryDirectory() as root:
            self.write_tree(root)
            for directory, _, files in os.walk(root):
                for name in files:
                    if name in ("results.json", "confirmation.json"):
                        path = os.path.join(directory, name)
                        with open(path) as fh:
                            data = fh.read().replace("readSerializedModuleAST", "apiCreateGlobalSession")
                        with open(path, "w") as fh:
                            fh.write(data)
            b = triage.build_bundle(root, label=self.LABELS[-1])
        self.assertEqual(b["flagged"][0]["outcome"], "warning")
        self.assertEqual(b["bisect_points"], ["sha6", "sha7"])

    def test_a_night_without_candidates_says_so_and_stops(self):
        b = self.bundle(candidate=False)
        self.assertFalse(b["has_candidates"])
        self.assertEqual(b["flagged"], [])

    def test_a_night_without_confirmation_says_so_and_stops(self):
        b = self.bundle(confirmation=False)
        self.assertFalse(b["has_candidates"])
        self.assertIn("no confirmation.json", b["notes"][0])

    def test_a_night_built_from_the_baselines_commit_is_a_measurement_difference(self):
        b = self.bundle(same_commit=True)
        self.assertTrue(b["commit_range"]["same_commit"])
        self.assertEqual(b["bisect_points"], [])
        self.assertTrue(any("measurement variation" in n for n in b["notes"]))

    def test_markdown_renders_each_section(self):
        md = triage.render_markdown(self.bundle())
        for text in ("## Flagged counters", "readSerializedModuleAST", "## Commit range",
                     "sha6", "Bisect endpoints", "immediate parent"):
            self.assertIn(text, md)

    def test_pick_point_by_label_commit_and_default(self):
        pts = [{"label": "2026-01-01-a", "date": "2026-01-01", "commit": "aaaa1111"},
               {"label": "2026-01-02-b", "date": "2026-01-02", "commit": "bbbb2222"}]
        self.assertEqual(triage.pick_point(pts)["label"], "2026-01-02-b")
        self.assertEqual(triage.pick_point(pts, commit="aaaa")["label"], "2026-01-01-a")
        self.assertEqual(triage.pick_point(pts, label="2026-01-01-a")["commit"], "aaaa1111")
        with self.assertRaises(triage.TriageError):
            triage.pick_point(pts, label="nope")
        with self.assertRaises(triage.TriageError):
            triage.pick_point(pts, commit="cccc")


if __name__ == "__main__":
    unittest.main()
