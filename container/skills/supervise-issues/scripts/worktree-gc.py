#!/usr/bin/env python3
"""worktree-gc.py — deterministic worktree reclaim classifier.

Every tier (fixer, reviewer, triager, slangpy-*) runs `worktree-gc-run.sh` as a
gated task inside its own container; that script discovers the tier's worktrees,
resolves issue/PR state with `gh`, and hands the set to this module. The
supervisor's §8 only reads the reports. The thresholds below are the single
source of truth: SKILL.md / reference.md reference them by name and never
restate the numbers.

Four tiers:

  REAP        remove the worktree (after saving uncommitted work to a local
              `wip/reap/<name>` branch). Primary fix trees whose PR is
              MERGED/CLOSED, or whose issue is CLOSED with no PR; primary trees
              with no PR idle > NOPR_IDLE_DAYS; every scratch tree whose PR is
              MERGED/CLOSED or that is idle > SCRATCH_IDLE_DAYS.
  STALE-OPEN  primary tree whose PR is OPEN but idle > STALE_OPEN_IDLE_DAYS:
              reclaim the regenerable `build/` in place, never the worktree.
  KEEP        anything with a running session, anything touched within
              MIN_IDLE_DAYS, scratch trees still in use, open PRs still active.
  NO-PR       primary tree, issue OPEN, no PR yet, not idle enough to reap.

`kind` tells primary from scratch. A primary tree is a tier's fix checkout
(`wt-slang-<n>`, `wt-slangpy-<n>`, `wt-slang-pr-<n>`, …); everything else —
`wt-<n>-verify`, `wt-<n>-master`, `wt-<n>-revA`, `wt-clarity-*`, nested or
freehand names — is scratch that holds no work the PR does not already hold.
`idle_days` is filesystem idleness (index, build log, directory mtimes);
`pr_idle_days` is GitHub idleness of the open PR.

`reclaim` (build-only) always holds every STALE-OPEN tree with a build. Under
disk pressure (free below PRESSURE_GATE_PCT of the volume) it widens to KEEP
trees whose open PR is idle > PRESSURE_IDLE_DAYS, and below CRITICAL_GATE_PCT to
idle > CRITICAL_IDLE_DAYS, most-idle first; the projection aims at
TARGET_FREE_PCT free. Without `total_gb` in the payload the share is unknown and
only STALE-OPEN builds are reclaimed. Reclaim deletes `<worktree>/build` and nothing else, so
`build_size_gb` — never `size_gb` — is what the projection adds; an unmeasured
build counts as 0 (under-projecting keeps the executor going, over-projecting
made a run stop with the disk still full). `summary.projected_free_gb` is a
lower bound: the executor re-measures with `df` and stops on that.

Input (stdin):

  {
    "free_gb": 2, "total_gb": 2481,
    "running_dirs": ["wt-slang-12073", ...],
    "worktrees": [
      {"dir": "wt-slang-11511", "kind": "primary", "idle_days": 3,
       "size_gb": 6.7, "build_size_gb": 4.1, "has_build": true,
       "issue_state": "OPEN", "pr_state": "OPEN", "pr_idle_days": 34},
      ...
    ]
  }

Output: {"tiers": {...}, "reclaim": [...], "summary": {...}}. Each worktree
gets a `gc_reason` string explaining its tier.

Run: python3 scripts/worktree-gc.py < payload.json
Test: python3 scripts/test_worktree_gc.py
"""

import json
import sys

# ─── Thresholds — the ONLY place these live. Markdown references them by name. ───
STALE_OPEN_IDLE_DAYS = 14   # open PR untouched longer than this → STALE-OPEN (build/ reclaimed)
SCRATCH_IDLE_DAYS = 2       # scratch tree idle longer than this → REAP
NOPR_IDLE_DAYS = 30         # primary tree with no PR idle longer than this → REAP
MIN_IDLE_DAYS = 1           # nothing touched within this many days is reaped or reclaimed
PRESSURE_GATE_PCT = 25      # free below this share of the volume → idle KEEP builds join the reclaim list
PRESSURE_IDLE_DAYS = 7      # under pressure, a KEEP build whose PR is idle > this is reclaimable
TARGET_FREE_PCT = 30        # projection target once under pressure (hysteresis above the gate)
CRITICAL_GATE_PCT = 2       # free below this share → ENOSPC-imminent
CRITICAL_IDLE_DAYS = 2      # under critical pressure, a KEEP build idle > this is reclaimable

FINAL_PR_STATES = ("MERGED", "CLOSED")


def _idle(wt):
    v = wt.get("idle_days")
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def classify(wt, running_dirs):
    """Pure per-worktree tier decision; also sets wt["gc_reason"]. No pressure or
    size logic here — that is select()'s job."""
    issue = (wt.get("issue_state") or "").upper()
    pr = (wt.get("pr_state") or "").upper()
    running = wt.get("dir") in running_dirs or bool(wt.get("running"))
    idle = _idle(wt)
    scratch = (wt.get("kind") or "primary") == "scratch"

    def tier(name, why):
        wt["gc_reason"] = why
        return name

    if running:
        return tier("KEEP", "running session")
    if idle is not None and idle < MIN_IDLE_DAYS:
        return tier("KEEP", f"touched {idle:g}d ago")

    if scratch:
        if pr in FINAL_PR_STATES:
            return tier("REAP", f"scratch, PR {pr}")
        if idle is not None and idle > SCRATCH_IDLE_DAYS:
            return tier("REAP", f"scratch, idle {idle:g}d")
        return tier("KEEP", "scratch, recently used")

    if pr in FINAL_PR_STATES:
        return tier("REAP", f"PR {pr}")
    if not pr:
        if issue == "CLOSED":
            return tier("REAP", "issue CLOSED, no PR")
        if idle is not None and idle > NOPR_IDLE_DAYS:
            return tier("REAP", f"no PR, idle {idle:g}d")
        return tier("NO-PR", "issue open, no PR")
    # PR OPEN (the issue may already be closed; the PR can still land).
    pr_idle = wt.get("pr_idle_days")
    if pr_idle is not None and pr_idle > STALE_OPEN_IDLE_DAYS:
        return tier("STALE-OPEN", f"open PR idle {pr_idle}d")
    return tier("KEEP", "open PR, active")


def build_measured(wt):
    """Was this worktree's `build/` actually measured? A genuinely measured empty
    build and an unmeasured one are different facts that share a number."""
    v = wt.get("build_size_gb")
    return isinstance(v, (int, float)) and not isinstance(v, bool) and v >= 0


def build_gb(wt):
    """GB a reclaim frees: the `build/` directory only. Unmeasured counts as 0."""
    v = wt.get("build_size_gb")
    if isinstance(v, (int, float)) and not isinstance(v, bool) and v >= 0:
        return float(v)
    return 0.0


def select(payload):
    """Classify every worktree, then build the build-only reclaim list: every
    STALE-OPEN build, plus idle KEEP builds under pressure. Pure: no filesystem,
    no gh calls."""
    free = payload.get("free_gb", 0)
    total = payload.get("total_gb") or 0
    running = set(payload.get("running_dirs", []))
    worktrees = payload.get("worktrees", [])

    tiers = {"REAP": [], "KEEP": [], "STALE-OPEN": [], "NO-PR": []}
    for wt in worktrees:
        tiers[classify(wt, running)].append(wt)

    free_pct = round(free * 100.0 / total, 1) if total else None
    under_pressure = free_pct is not None and free_pct < PRESSURE_GATE_PCT
    critical = free_pct is not None and free_pct < CRITICAL_GATE_PCT
    target_gb = total * TARGET_FREE_PCT / 100.0 if total else None

    cands = [w for w in tiers["STALE-OPEN"] if w.get("has_build")]
    if under_pressure:
        floor = CRITICAL_IDLE_DAYS if critical else PRESSURE_IDLE_DAYS
        cands += [
            w for w in tiers["KEEP"]
            if w.get("has_build")
            and w.get("dir") not in running
            and not w.get("running")
            and (w.get("pr_idle_days") or 0) > floor
        ]
    cands.sort(key=lambda w: w.get("pr_idle_days") or 0, reverse=True)

    # Every eligible candidate is returned, most idle first. The projected
    # cutoff is an index, never a truncation: the executor stops on measured df.
    reclaim = list(cands)
    projected = free
    projected_cutoff = len(cands)
    for i, w in enumerate(cands):
        if target_gb is not None and projected >= target_gb:
            projected_cutoff = i
            break
        projected += build_gb(w)

    summary = {
        "free_gb": free,
        "total_gb": total,
        "free_pct": free_pct,
        "target_free_gb": round(target_gb, 1) if target_gb is not None else None,
        "under_pressure": under_pressure,
        "critical": critical,
        "counts": {k: len(v) for k, v in tiers.items()},
        "reclaim_count": len(reclaim),
        "reclaim_gb": round(sum(build_gb(w) for w in reclaim), 1),
        "unmeasured_builds": sum(1 for w in reclaim if not build_measured(w)),
        "projected_sufficient_count": projected_cutoff,
        "projected_free_gb": round(projected, 1),
        "projection_is_lower_bound": True,
        "thresholds": {
            "STALE_OPEN_IDLE_DAYS": STALE_OPEN_IDLE_DAYS,
            "SCRATCH_IDLE_DAYS": SCRATCH_IDLE_DAYS,
            "NOPR_IDLE_DAYS": NOPR_IDLE_DAYS,
            "MIN_IDLE_DAYS": MIN_IDLE_DAYS,
            "PRESSURE_GATE_PCT": PRESSURE_GATE_PCT,
            "PRESSURE_IDLE_DAYS": PRESSURE_IDLE_DAYS,
            "TARGET_FREE_PCT": TARGET_FREE_PCT,
            "CRITICAL_GATE_PCT": CRITICAL_GATE_PCT,
            "CRITICAL_IDLE_DAYS": CRITICAL_IDLE_DAYS,
        },
    }
    return {"tiers": tiers, "reclaim": reclaim, "summary": summary}


def main():
    raw = sys.stdin.read()
    if not raw.strip():
        print("worktree-gc.py: empty stdin; expected payload JSON", file=sys.stderr)
        return 2
    payload = json.loads(raw)
    print(json.dumps(select(payload), indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
