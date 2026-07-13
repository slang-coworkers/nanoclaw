#!/usr/bin/env python3
"""Tests for worktree-gc.py — the deterministic §8 reclaim classifier.

Each test pins a rule that, if it regressed, reproduces a real failure mode:
the ENOSPC fill (STALE-OPEN never reclaimed), or the opposite risk of churning
an active chain's build. Run: python3 test_worktree_gc.py
"""

import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "worktree_gc", Path(__file__).with_name("worktree-gc.py")
)
wg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wg)


def wt(dir, issue="OPEN", pr="OPEN", idle=None, size=6.7, has_build=True):
    return {"dir": dir, "issue_state": issue, "pr_state": pr,
            "pr_idle_days": idle, "size_gb": size, "has_build": has_build}


class TestClassify(unittest.TestCase):
    def test_reap_merged_pr(self):
        self.assertEqual(wg.classify(wt("a", pr="MERGED"), set()), "REAP")

    def test_reap_closed_pr(self):
        self.assertEqual(wg.classify(wt("a", pr="CLOSED"), set()), "REAP")

    def test_reap_closed_issue_even_with_open_pr(self):
        # Closed issue reaps regardless of a lingering draft PR.
        self.assertEqual(wg.classify(wt("a", issue="CLOSED", pr="OPEN"), set()), "REAP")

    def test_keep_open_pr_recent(self):
        self.assertEqual(wg.classify(wt("a", idle=3), set()), "KEEP")

    def test_keep_open_pr_running_even_if_idle(self):
        # A running session pins KEEP no matter how idle the PR looks.
        self.assertEqual(wg.classify(wt("a", idle=99), {"a"}), "KEEP")

    def test_stale_open_idle_beyond_threshold(self):
        self.assertEqual(wg.classify(wt("a", idle=15), set()), "STALE-OPEN")

    def test_boundary_exactly_threshold_is_keep(self):
        # > N days, not >=. Exactly 14d stays KEEP.
        self.assertEqual(wg.classify(wt("a", idle=wg.STALE_OPEN_IDLE_DAYS), set()), "KEEP")
        self.assertEqual(
            wg.classify(wt("a", idle=wg.STALE_OPEN_IDLE_DAYS + 1), set()), "STALE-OPEN"
        )

    def test_no_pr(self):
        self.assertEqual(wg.classify(wt("a", pr=""), set()), "NO-PR")

    def test_open_pr_missing_idle_is_keep(self):
        # No idle signal → don't assume stale.
        self.assertEqual(wg.classify(wt("a", idle=None), set()), "KEEP")


class TestSelect(unittest.TestCase):
    def test_no_reclaim_when_disk_healthy(self):
        # Above the pressure gate: STALE-OPEN classified but nothing reclaimed.
        out = wg.select({"free_gb": 50, "running_dirs": [],
                         "worktrees": [wt("a", idle=40)]})
        self.assertEqual(out["summary"]["counts"]["STALE-OPEN"], 1)
        self.assertEqual(out["reclaim"], [])
        self.assertFalse(out["summary"]["under_pressure"])

    def test_reclaim_under_pressure_oldest_first_until_target(self):
        payload = {
            "free_gb": 2, "running_dirs": [],
            "worktrees": [
                wt("young", idle=15, size=6),
                wt("oldest", idle=40, size=6),
                wt("middle", idle=25, size=6),
            ],
        }
        out = wg.select(payload)
        dirs = [w["dir"] for w in out["reclaim"]]
        # free 2 → target 40 needs +38G → 7 would be needed but only 3 exist (18G);
        # all three selected, ordered most-idle first.
        self.assertEqual(dirs, ["oldest", "middle", "young"])

    def test_reclaim_stops_once_target_met(self):
        payload = {
            "free_gb": 20, "running_dirs": [],
            "worktrees": [wt(f"w{i}", idle=30 + i, size=10) for i in range(5)],
        }
        out = wg.select(payload)
        # free 20, target 40 → need +20G → two 10G builds, then stop.
        self.assertEqual(out["summary"]["reclaim_count"], 2)

    def test_reclaim_skips_worktrees_without_build(self):
        out = wg.select({"free_gb": 2, "running_dirs": [],
                         "worktrees": [wt("a", idle=40, has_build=False)]})
        self.assertEqual(out["reclaim"], [])

    def test_running_stale_pr_never_reclaimed(self):
        out = wg.select({"free_gb": 2, "running_dirs": ["a"],
                         "worktrees": [wt("a", idle=40)]})
        self.assertEqual(out["summary"]["counts"]["KEEP"], 1)
        self.assertEqual(out["reclaim"], [])

    def test_thresholds_echoed_in_summary(self):
        out = wg.select({"free_gb": 2, "running_dirs": [], "worktrees": []})
        self.assertEqual(out["summary"]["thresholds"]["STALE_OPEN_IDLE_DAYS"], 14)
        self.assertEqual(out["summary"]["thresholds"]["PRESSURE_GATE_GB"], 25)
        self.assertEqual(out["summary"]["thresholds"]["TARGET_FREE_GB"], 40)
        self.assertEqual(out["summary"]["thresholds"]["CRITICAL_GATE_GB"], 5)
        self.assertEqual(out["summary"]["thresholds"]["CRITICAL_IDLE_DAYS"], 2)


class TestCriticalTier(unittest.TestCase):
    def test_routine_pressure_does_not_touch_keep_builds(self):
        # 10G free (< 25 routine, but >= 5 critical): idle KEEP build stays KEEP,
        # NOT reclaimed. This is the 12:10-tick case — nothing safe to reclaim.
        out = wg.select({"free_gb": 10, "running_dirs": [],
                         "worktrees": [wt("k", idle=3, size=7)]})
        self.assertEqual(out["summary"]["counts"]["KEEP"], 1)
        self.assertFalse(out["summary"]["critical"])
        self.assertEqual(out["reclaim"], [])

    def test_critical_pressure_reclaims_idle_keep_build(self):
        # 2G free (< 5 critical): a KEEP build idle > 2d with no running session
        # becomes reclaimable — the 7GB-fixer-build emergency lever.
        out = wg.select({"free_gb": 2, "running_dirs": [],
                         "worktrees": [wt("k", idle=3, size=7)]})
        self.assertTrue(out["summary"]["critical"])
        self.assertEqual([w["dir"] for w in out["reclaim"]], ["k"])

    def test_critical_never_reclaims_running_keep(self):
        # Even critical + idle: a running session pins KEEP, never reclaimed.
        out = wg.select({"free_gb": 1, "running_dirs": ["k"],
                         "worktrees": [wt("k", idle=9, size=7)]})
        self.assertEqual(out["reclaim"], [])

    def test_critical_respects_idle_floor(self):
        # KEEP build idle only 1d (< CRITICAL_IDLE_DAYS): not reclaimed even at 1G.
        out = wg.select({"free_gb": 1, "running_dirs": [],
                         "worktrees": [wt("fresh", idle=1, size=7)]})
        self.assertEqual(out["reclaim"], [])

    def test_critical_prefers_stale_open_then_idle_keep_oldest_first(self):
        # Mixed: STALE-OPEN (idle 40) + idle KEEP (idle 5). Both eligible under
        # critical; ordered most-idle first regardless of tier.
        out = wg.select({"free_gb": 1, "running_dirs": [],
                         "worktrees": [wt("keep5", idle=5, size=7),
                                       wt("stale40", idle=40, size=7)]})
        self.assertEqual([w["dir"] for w in out["reclaim"]][0], "stale40")
        self.assertEqual(set(w["dir"] for w in out["reclaim"]), {"stale40", "keep5"})


if __name__ == "__main__":
    unittest.main()
