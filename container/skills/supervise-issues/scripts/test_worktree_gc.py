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


OMIT = object()  # build_size=OMIT → the payload carries no build_size_gb at all


def wt(dir, issue="OPEN", pr="OPEN", idle=None, size=6.7, has_build=True,
       build_size=None):
    """`size` is the WHOLE worktree; `build_size` is the build/ dir the reclaim
    actually deletes. It defaults to a realistic ~60% of the worktree so the two
    are never accidentally interchangeable in a test."""
    w = {"dir": dir, "issue_state": issue, "pr_state": pr,
         "pr_idle_days": idle, "size_gb": size, "has_build": has_build}
    if build_size is not OMIT:
        w["build_size_gb"] = round(size * 0.6, 2) if build_size is None else build_size
    return w


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
                wt("young", idle=15, size=6, build_size=4),
                wt("oldest", idle=40, size=6, build_size=4),
                wt("middle", idle=25, size=6, build_size=4),
            ],
        }
        out = wg.select(payload)
        dirs = [w["dir"] for w in out["reclaim"]]
        # free 2 → target 40 needs +38G; only 12G of build/ exists, so all three
        # are selected, ordered most-idle first.
        self.assertEqual(dirs, ["oldest", "middle", "young"])

    def test_projection_reports_a_cutoff_without_truncating_the_list(self):
        payload = {
            "free_gb": 20, "running_dirs": [],
            "worktrees": [wt(f"w{i}", idle=30 + i, size=10, build_size=6) for i in range(5)],
        }
        out = wg.select(payload)
        # free 20, target 40 → need +20G. Each reclaim frees the 6G build/, NOT
        # the 10G worktree, so the PROJECTION expects four to be enough.
        self.assertEqual(out["summary"]["projected_sufficient_count"], 4)
        # …but every eligible candidate is still handed over. select() used to
        # `break` here and return only those four, which is the F17 defect: the
        # executor stops on MEASURED df, so if those four free less than their
        # `du` claimed it runs out of list with a fifth eligible build it was
        # never told about, and escalates for disk it was holding the answer to.
        self.assertEqual(out["summary"]["reclaim_count"], 5)
        self.assertEqual([w["dir"] for w in out["reclaim"]],
                         ["w4", "w3", "w2", "w1", "w0"])
        # reclaim_gb is the whole list's build/ total, so it can exceed the need.
        self.assertEqual(out["summary"]["reclaim_gb"], 30.0)

    def test_headroom_survives_an_over_optimistic_estimate(self):
        """The failure F17 describes, end to end.

        Four builds claim 6G each; the executor deletes them and `df` moves less
        than promised (open handles, hard links, a build still growing). It must
        still have somewhere to go."""
        payload = {
            "free_gb": 20, "running_dirs": [],
            "worktrees": [wt(f"w{i}", idle=30 + i, size=10, build_size=6) for i in range(5)],
        }
        reclaim = wg.select(payload)["reclaim"]
        cutoff = wg.select(payload)["summary"]["projected_sufficient_count"]
        # There is list left AFTER the point the projection thought sufficient.
        self.assertGreater(len(reclaim), cutoff)

    def test_a_measured_empty_build_is_not_reported_unmeasured(self):
        # 0.0 as a real measurement and 0.0 as "never measured" are different
        # facts. `unmeasured_builds` exists to say "the projection understates";
        # counting a genuine 0.0 there reports missing data that is not missing.
        payload = {
            "free_gb": 2, "running_dirs": [],
            "worktrees": [wt("measured-empty", idle=40, size=1, build_size=0.0),
                          wt("never-measured", idle=41, size=1, build_size=OMIT)],
        }
        out = wg.select(payload)
        self.assertEqual(out["summary"]["reclaim_count"], 2)
        self.assertEqual(out["summary"]["unmeasured_builds"], 1)

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


class TestBuildSizeAccounting(unittest.TestCase):
    """A reclaim deletes `<worktree>/build` and nothing else. Counting the whole
    worktree as reclaimed let a plan claim it had reached TARGET_FREE_GB after
    freeing a fraction of that — the supervisor then stopped deleting while the
    filesystem was still under ENOSPC pressure."""

    def test_reclaim_gb_counts_build_not_worktree(self):
        out = wg.select({"free_gb": 2, "running_dirs": [],
                         "worktrees": [wt("a", idle=40, size=20, build_size=3)]})
        self.assertEqual(out["summary"]["reclaim_gb"], 3.0)

    def test_projection_advances_by_build_size_only(self):
        # One 30G worktree with a 5G build. The old math projected 2 + 30 = 32
        # and stopped; the truth is 2 + 5 = 7, still far under the 40G target.
        out = wg.select({"free_gb": 2, "running_dirs": [],
                         "worktrees": [wt("a", idle=40, size=30, build_size=5)]})
        self.assertEqual(out["summary"]["projected_free_gb"], 7.0)
        self.assertTrue(out["summary"]["projection_is_lower_bound"])

    def test_a_gc_run_that_frees_less_than_the_worktree_keeps_going(self):
        # Four idle chains, 25G each but only 5G of build/. Reaching 40 from 5
        # needs 35G, and 20G is all there is — every one is selected rather than
        # the first stopping the loop.
        out = wg.select({
            "free_gb": 5, "running_dirs": [],
            "worktrees": [wt(f"w{i}", idle=30 + i, size=25, build_size=5) for i in range(4)],
        })
        self.assertEqual(out["summary"]["reclaim_count"], 4)
        self.assertEqual(out["summary"]["reclaim_gb"], 20.0)
        # And it is honest that this does not clear the pressure.
        self.assertLess(out["summary"]["projected_free_gb"], wg.TARGET_FREE_GB)

    def test_unmeasured_build_counts_as_zero_not_as_the_worktree(self):
        # `build_size_gb` absent: contributes nothing to the projection, so the
        # loop keeps selecting. Over-projecting here is what stopped the old run
        # early; under-projecting only costs an extra rebuild.
        out = wg.select({
            "free_gb": 2, "running_dirs": [],
            "worktrees": [wt("unmeasured", idle=40, size=30, build_size=OMIT),
                          wt("measured", idle=30, size=10, build_size=6)],
        })
        self.assertEqual([w["dir"] for w in out["reclaim"]], ["unmeasured", "measured"])
        self.assertEqual(out["summary"]["reclaim_gb"], 6.0)
        self.assertEqual(out["summary"]["unmeasured_builds"], 1)

    def test_malformed_build_size_is_not_trusted(self):
        # A null, a string, a negative, and a bool are all "no measurement", not
        # a licence to fall back to size_gb.
        for bad in (None, "4.2", -3, True):
            w = wt("a", idle=40, size=30, build_size=OMIT)
            w["build_size_gb"] = bad
            out = wg.select({"free_gb": 2, "running_dirs": [], "worktrees": [w]})
            self.assertEqual(out["summary"]["reclaim_gb"], 0.0, f"build_size={bad!r}")
            self.assertEqual(out["summary"]["projected_free_gb"], 2.0, f"build_size={bad!r}")

    def test_healthy_disk_still_reclaims_nothing(self):
        out = wg.select({"free_gb": 50, "running_dirs": [],
                         "worktrees": [wt("a", idle=40, size=30, build_size=20)]})
        self.assertEqual(out["reclaim"], [])
        self.assertEqual(out["summary"]["reclaim_gb"], 0.0)
        self.assertEqual(out["summary"]["projected_free_gb"], 50.0)


if __name__ == "__main__":
    unittest.main()
