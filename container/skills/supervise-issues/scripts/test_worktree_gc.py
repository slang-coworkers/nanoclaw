#!/usr/bin/env python3
"""Tests for worktree-gc.py — the deterministic worktree reclaim classifier.

Each test pins a rule that, if it regressed, reproduces a real failure mode:
the volume filling with regenerable builds and finished-review scratch trees,
or the opposite risk of removing a tree a live session is using.
Run: python3 test_worktree_gc.py
"""

import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "worktree_gc", Path(__file__).with_name("worktree-gc.py")
)
wg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wg)


OMIT = object()  # build_size=OMIT → the payload carries no build_size_gb at all


def wt(dir, issue="OPEN", pr="OPEN", idle=None, size=6.7, has_build=True,
       build_size=None, kind="primary", fs_idle=5.0):
    """`idle` is the open PR's GitHub idleness; `fs_idle` is filesystem idleness
    (default 5 days: old enough that MIN_IDLE_DAYS never interferes). `size` is
    the whole worktree; `build_size` the build/ dir a reclaim deletes."""
    w = {"dir": dir, "kind": kind, "idle_days": fs_idle, "issue_state": issue,
         "pr_state": pr, "pr_idle_days": idle, "size_gb": size, "has_build": has_build}
    if build_size is not OMIT:
        w["build_size_gb"] = round(size * 0.6, 2) if build_size is None else build_size
    return w


class TestPrimary(unittest.TestCase):
    def test_reap_merged_pr(self):
        self.assertEqual(wg.classify(wt("a", pr="MERGED"), set()), "REAP")

    def test_reap_closed_pr(self):
        self.assertEqual(wg.classify(wt("a", pr="CLOSED"), set()), "REAP")

    def test_closed_issue_with_open_pr_is_not_reaped(self):
        # The PR can still land; its build is reclaimed through STALE-OPEN instead.
        self.assertEqual(wg.classify(wt("a", issue="CLOSED", pr="OPEN", idle=3), set()), "KEEP")
        self.assertEqual(wg.classify(wt("a", issue="CLOSED", pr="OPEN", idle=20), set()), "STALE-OPEN")

    def test_reap_closed_issue_without_pr(self):
        self.assertEqual(wg.classify(wt("a", issue="CLOSED", pr=""), set()), "REAP")

    def test_keep_open_pr_recent(self):
        self.assertEqual(wg.classify(wt("a", idle=3), set()), "KEEP")

    def test_keep_running_even_if_idle(self):
        self.assertEqual(wg.classify(wt("a", idle=99), {"a"}), "KEEP")
        w = wt("a", pr="MERGED"); w["running"] = True
        self.assertEqual(wg.classify(w, set()), "KEEP")

    def test_stale_open_idle_beyond_threshold(self):
        self.assertEqual(wg.classify(wt("a", idle=15), set()), "STALE-OPEN")

    def test_boundary_exactly_threshold_is_keep(self):
        self.assertEqual(wg.classify(wt("a", idle=wg.STALE_OPEN_IDLE_DAYS), set()), "KEEP")
        self.assertEqual(wg.classify(wt("a", idle=wg.STALE_OPEN_IDLE_DAYS + 1), set()), "STALE-OPEN")

    def test_no_pr_recent_waits(self):
        self.assertEqual(wg.classify(wt("a", pr="", fs_idle=10), set()), "NO-PR")

    def test_no_pr_idle_long_is_reaped(self):
        self.assertEqual(wg.classify(wt("a", pr="", fs_idle=wg.NOPR_IDLE_DAYS + 1), set()), "REAP")
        self.assertEqual(wg.classify(wt("a", pr="", fs_idle=wg.NOPR_IDLE_DAYS), set()), "NO-PR")

    def test_unresolvable_number_counts_as_no_pr(self):
        # No issue or PR state at all (name without a resolvable number).
        self.assertEqual(wg.classify(wt("a", issue="", pr="", fs_idle=10), set()), "NO-PR")
        self.assertEqual(wg.classify(wt("a", issue="", pr="", fs_idle=40), set()), "REAP")

    def test_open_pr_missing_idle_is_keep(self):
        self.assertEqual(wg.classify(wt("a", idle=None), set()), "KEEP")

    def test_anything_touched_today_is_kept(self):
        # A merged PR's tree that was touched an hour ago may still be in use.
        self.assertEqual(wg.classify(wt("a", pr="MERGED", fs_idle=0.04), set()), "KEEP")
        self.assertEqual(wg.classify(wt("a", kind="scratch", fs_idle=0.5), set()), "KEEP")

    def test_reason_recorded(self):
        w = wt("a", pr="MERGED")
        wg.classify(w, set())
        self.assertEqual(w["gc_reason"], "PR MERGED")


class TestScratch(unittest.TestCase):
    def test_idle_scratch_is_reaped_regardless_of_pr_state(self):
        self.assertEqual(wg.classify(wt("a", kind="scratch", pr="OPEN", idle=1, fs_idle=3), set()), "REAP")
        self.assertEqual(wg.classify(wt("a", kind="scratch", pr="", issue="", fs_idle=3), set()), "REAP")

    def test_recent_scratch_is_kept(self):
        self.assertEqual(wg.classify(wt("a", kind="scratch", fs_idle=1.5), set()), "KEEP")
        self.assertEqual(wg.classify(wt("a", kind="scratch", fs_idle=wg.SCRATCH_IDLE_DAYS), set()), "KEEP")

    def test_scratch_of_finished_pr_is_reaped_once_idle_a_day(self):
        self.assertEqual(wg.classify(wt("a", kind="scratch", pr="MERGED", fs_idle=1.2), set()), "REAP")

    def test_running_scratch_is_kept(self):
        self.assertEqual(wg.classify(wt("a", kind="scratch", fs_idle=30), {"a"}), "KEEP")

    def test_scratch_never_enters_stale_open(self):
        out = wg.select({"free_gb": 300, "total_gb": 1000, "running_dirs": [],
                         "worktrees": [wt("a", kind="scratch", idle=40, fs_idle=1.5)]})
        self.assertEqual(out["summary"]["counts"]["STALE-OPEN"], 0)
        self.assertEqual(out["reclaim"], [])


class TestSelect(unittest.TestCase):
    def test_stale_open_build_reclaimed_even_when_disk_healthy(self):
        out = wg.select({"free_gb": 500, "total_gb": 1000, "running_dirs": [],
                         "worktrees": [wt("a", idle=40)]})
        self.assertEqual(out["summary"]["counts"]["STALE-OPEN"], 1)
        self.assertEqual([w["dir"] for w in out["reclaim"]], ["a"])
        self.assertFalse(out["summary"]["under_pressure"])

    def test_healthy_disk_leaves_keep_builds_alone(self):
        out = wg.select({"free_gb": 500, "total_gb": 1000, "running_dirs": [],
                         "worktrees": [wt("k", idle=10, size=7)]})
        self.assertEqual(out["summary"]["counts"]["KEEP"], 1)
        self.assertEqual(out["reclaim"], [])

    def test_reclaim_most_idle_first(self):
        payload = {"free_gb": 2, "total_gb": 1000, "running_dirs": [],
                   "worktrees": [wt("young", idle=15, size=6, build_size=4),
                                 wt("oldest", idle=40, size=6, build_size=4),
                                 wt("middle", idle=25, size=6, build_size=4)]}
        out = wg.select(payload)
        self.assertEqual([w["dir"] for w in out["reclaim"]], ["oldest", "middle", "young"])

    def test_projection_reports_a_cutoff_without_truncating_the_list(self):
        payload = {"free_gb": 22, "total_gb": 100, "running_dirs": [],
                   "worktrees": [wt(f"w{i}", idle=30 + i, size=10, build_size=6) for i in range(5)]}
        out = wg.select(payload)
        # 22% free, target 30% of 100 → +8G; each reclaim frees the 6G build/, so
        # two should be enough — but every eligible build is still handed over.
        self.assertEqual(out["summary"]["projected_sufficient_count"], 2)
        self.assertEqual(out["summary"]["reclaim_count"], 5)
        self.assertEqual([w["dir"] for w in out["reclaim"]], ["w4", "w3", "w2", "w1", "w0"])
        self.assertEqual(out["summary"]["reclaim_gb"], 30.0)

    def test_a_measured_empty_build_is_not_reported_unmeasured(self):
        payload = {"free_gb": 2, "total_gb": 1000, "running_dirs": [],
                   "worktrees": [wt("measured-empty", idle=40, size=1, build_size=0.0),
                                 wt("never-measured", idle=41, size=1, build_size=OMIT)]}
        out = wg.select(payload)
        self.assertEqual(out["summary"]["reclaim_count"], 2)
        self.assertEqual(out["summary"]["unmeasured_builds"], 1)

    def test_reclaim_skips_worktrees_without_build(self):
        out = wg.select({"free_gb": 2, "total_gb": 1000, "running_dirs": [],
                         "worktrees": [wt("a", idle=40, has_build=False)]})
        self.assertEqual(out["reclaim"], [])

    def test_running_stale_pr_never_reclaimed(self):
        out = wg.select({"free_gb": 2, "total_gb": 1000, "running_dirs": ["a"],
                         "worktrees": [wt("a", idle=40)]})
        self.assertEqual(out["summary"]["counts"]["KEEP"], 1)
        self.assertEqual(out["reclaim"], [])

    def test_reap_trees_are_not_in_the_build_reclaim_list(self):
        # A REAP tree goes whole; listing its build too would double-count.
        out = wg.select({"free_gb": 2, "total_gb": 1000, "running_dirs": [],
                         "worktrees": [wt("a", pr="MERGED", idle=40)]})
        self.assertEqual(out["summary"]["counts"]["REAP"], 1)
        self.assertEqual(out["reclaim"], [])

    def test_thresholds_echoed_in_summary(self):
        t = wg.select({"free_gb": 2, "total_gb": 1000, "running_dirs": [], "worktrees": []})["summary"]["thresholds"]
        for name in ("STALE_OPEN_IDLE_DAYS", "SCRATCH_IDLE_DAYS", "NOPR_IDLE_DAYS", "MIN_IDLE_DAYS",
                     "PRESSURE_GATE_PCT", "PRESSURE_IDLE_DAYS", "TARGET_FREE_PCT",
                     "CRITICAL_GATE_PCT", "CRITICAL_IDLE_DAYS"):
            self.assertEqual(t[name], getattr(wg, name))


class TestPressure(unittest.TestCase):
    def test_routine_pressure_leaves_recently_active_keep_builds(self):
        out = wg.select({"free_gb": 10, "total_gb": 100, "running_dirs": [],
                         "worktrees": [wt("k", idle=3, size=7)]})
        self.assertFalse(out["summary"]["critical"])
        self.assertEqual(out["reclaim"], [])

    def test_routine_pressure_reclaims_keep_builds_idle_past_the_pressure_floor(self):
        out = wg.select({"free_gb": 10, "total_gb": 100, "running_dirs": [],
                         "worktrees": [wt("k", idle=wg.PRESSURE_IDLE_DAYS + 1, size=7)]})
        self.assertEqual([w["dir"] for w in out["reclaim"]], ["k"])

    def test_critical_pressure_reclaims_idle_keep_build(self):
        out = wg.select({"free_gb": 2, "total_gb": 1000, "running_dirs": [],
                         "worktrees": [wt("k", idle=3, size=7)]})
        self.assertTrue(out["summary"]["critical"])
        self.assertEqual([w["dir"] for w in out["reclaim"]], ["k"])

    def test_critical_never_reclaims_running_keep(self):
        out = wg.select({"free_gb": 1, "total_gb": 1000, "running_dirs": ["k"],
                         "worktrees": [wt("k", idle=9, size=7)]})
        self.assertEqual(out["reclaim"], [])

    def test_critical_respects_idle_floor(self):
        out = wg.select({"free_gb": 1, "total_gb": 1000, "running_dirs": [],
                         "worktrees": [wt("fresh", idle=1, size=7)]})
        self.assertEqual(out["reclaim"], [])

    def test_critical_prefers_most_idle_regardless_of_tier(self):
        out = wg.select({"free_gb": 1, "total_gb": 1000, "running_dirs": [],
                         "worktrees": [wt("keep5", idle=5, size=7), wt("stale40", idle=40, size=7)]})
        self.assertEqual(next(w["dir"] for w in out["reclaim"]), "stale40")
        self.assertEqual({w["dir"] for w in out["reclaim"]}, {"stale40", "keep5"})


class TestUnknownVolume(unittest.TestCase):
    def test_without_total_only_stale_open_builds_are_reclaimed(self):
        out = wg.select({"free_gb": 1, "running_dirs": [],
                         "worktrees": [wt("stale", idle=40), wt("keep", idle=9)]})
        self.assertIsNone(out["summary"]["free_pct"])
        self.assertFalse(out["summary"]["under_pressure"])
        self.assertEqual([w["dir"] for w in out["reclaim"]], ["stale"])


class TestBuildSizeAccounting(unittest.TestCase):
    """A reclaim deletes `<worktree>/build` and nothing else; the projection
    must add that figure, never the whole worktree."""

    def test_reclaim_gb_counts_build_not_worktree(self):
        out = wg.select({"free_gb": 2, "total_gb": 1000, "running_dirs": [],
                         "worktrees": [wt("a", idle=40, size=20, build_size=3)]})
        self.assertEqual(out["summary"]["reclaim_gb"], 3.0)

    def test_projection_advances_by_build_size_only(self):
        out = wg.select({"free_gb": 2, "total_gb": 1000, "running_dirs": [],
                         "worktrees": [wt("a", idle=40, size=30, build_size=5)]})
        self.assertEqual(out["summary"]["projected_free_gb"], 7.0)
        self.assertTrue(out["summary"]["projection_is_lower_bound"])

    def test_a_gc_run_that_frees_less_than_the_worktree_keeps_going(self):
        out = wg.select({"free_gb": 5, "total_gb": 1000, "running_dirs": [],
                         "worktrees": [wt(f"w{i}", idle=30 + i, size=25, build_size=5) for i in range(4)]})
        self.assertEqual(out["summary"]["reclaim_count"], 4)
        self.assertEqual(out["summary"]["reclaim_gb"], 20.0)
        self.assertLess(out["summary"]["projected_free_gb"], out["summary"]["target_free_gb"])

    def test_unmeasured_build_counts_as_zero_not_as_the_worktree(self):
        out = wg.select({"free_gb": 2, "total_gb": 1000, "running_dirs": [],
                         "worktrees": [wt("unmeasured", idle=40, size=30, build_size=OMIT),
                                       wt("measured", idle=30, size=10, build_size=6)]})
        self.assertEqual([w["dir"] for w in out["reclaim"]], ["unmeasured", "measured"])
        self.assertEqual(out["summary"]["reclaim_gb"], 6.0)
        self.assertEqual(out["summary"]["unmeasured_builds"], 1)

    def test_malformed_build_size_is_not_trusted(self):
        for bad in (None, "4.2", -3, True):
            w = wt("a", idle=40, size=30, build_size=OMIT)
            w["build_size_gb"] = bad
            out = wg.select({"free_gb": 2, "total_gb": 1000, "running_dirs": [], "worktrees": [w]})
            self.assertEqual(out["summary"]["reclaim_gb"], 0.0, f"build_size={bad!r}")
            self.assertEqual(out["summary"]["projected_free_gb"], 2.0, f"build_size={bad!r}")


if __name__ == "__main__":
    unittest.main()
