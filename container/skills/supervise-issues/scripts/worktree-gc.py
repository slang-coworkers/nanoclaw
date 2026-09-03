#!/usr/bin/env python3
"""worktree-gc.py — deterministic worktree reclaim classifier for §8.

§8's reap decision used to be a hard binary (REAP if PR merged/closed OR issue
closed; else KEEP). That binary is *why* the slang-fixer volume once filled to
ENOSPC: an OPEN PR that has been dead for a month is indistinguishable from one
merging today, so nothing between pressure events is ever reclaimable. This
script carves a third tier — STALE-OPEN — out of KEEP, and it is the single
source of truth for the thresholds (SKILL.md / reference.md reference these
constants by name and MUST NOT restate the numbers as prose).

Four tiers (see reference.md → *Worktree GC*):

  REAP       PR MERGED/CLOSED, or issue CLOSED       → save-then-remove worktree
  KEEP       issue OPEN + PR OPEN active, or running → leave untouched
  STALE-OPEN issue OPEN + PR OPEN idle > N days,     → reclaim regenerable build/
             no running session, under disk pressure   IN PLACE (never the worktree)
  NO-PR      issue OPEN, no PR / no number in name   → wake owner to confirm

STALE-OPEN reclaims only the gitignored `build/` cmake output — source, branch,
uncommitted work, and the PR are untouched, so a still-live PR can still land
(the worktree survives). It fires only under pressure and only until the target
free is met, oldest-PR-first, so a healthy disk churns nothing.

CRITICAL tier: below CRITICAL_GATE_GB (ENOSPC-imminent) the build-reclaim pool
widens to also include idle KEEP builds — open PRs touched within 14d but idle
> CRITICAL_IDLE_DAYS with no running session (the 7GB fixer builds routine
pressure can't touch). Still build-only, still never the worktree. This is the
lever the 2026-07-13 emergency lacked: at <5GB free the crash risk outweighs
one rebuild's churn.

MEASURE `build/`, NOT THE WORKTREE. Every reclaim deletes `<worktree>/build` and
nothing else, so `build_size_gb` — not `size_gb` — is what a reclaim frees.
Discovery used to report the whole-worktree `du` as the reclaimable amount, and
the projection added that, so a plan could claim it had reached TARGET_FREE_GB
after deleting a fraction of it and STOP while the filesystem was still under
ENOSPC pressure. A worktree whose `build/` was never measured counts as ZERO
here: under-projecting keeps the supervisor deleting, over-projecting is what
made it stop early.

The projection is a LOWER BOUND, never a result. `summary.projected_free_gb`
says what the plan would free if every build is exactly its measurement; the
caller must re-measure ACTUAL free space with `df` after each deletion and stop
on that, never on the projection (see reference.md → *Worktree GC*).

Pure I/O split (mirrors pull-universe.sh → scan.py): the caller resolves each
worktree's gh state and passes it in as JSON; `classify()` and `select()` are
pure and tested by test_worktree_gc.py. Input schema (stdin or --in):

  {
    "free_gb": 2,
    "running_dirs": ["wt-slang-12073", ...],   # dirs with a live/running session
    "worktrees": [
      {"dir": "wt-slang-11511", "size_gb": 6.7, "build_size_gb": 4.1,
       "has_build": true, "issue_state": "OPEN", "pr_state": "OPEN",
       "pr_idle_days": 34},
      ...
    ]
  }

`size_gb` is the whole worktree and is reported only. `build_size_gb` is the
`build/` directory alone and is the ONLY figure the reclaim math uses.

Output: {"tiers": {...}, "reclaim": [...], "summary": {...}} — `reclaim` is the
ordered STALE-OPEN build-reclaim dispatch list (empty unless under pressure).

Run: python3 scripts/worktree-gc.py < payload.json
Test: python3 scripts/test_worktree_gc.py
"""

import json
import sys

# ─── Thresholds — the ONLY place these live. Markdown references them by name. ───
STALE_OPEN_IDLE_DAYS = 14   # PR untouched longer than this + no running session → STALE-OPEN
PRESSURE_GATE_GB = 150      # only reclaim STALE-OPEN builds when free < this
TARGET_FREE_GB = 170        # stop reclaiming once free would reach this
CRITICAL_GATE_GB = 5        # below this = ENOSPC-imminent: widen reclaim to idle KEEP builds too
CRITICAL_IDLE_DAYS = 2      # under critical pressure, a KEEP build idle > this is reclaimable


def classify(wt, running_dirs):
    """Pure per-worktree tier decision. `wt` is one worktree dict; returns a tier
    string. No pressure/size logic here — that's select()'s job."""
    issue = (wt.get("issue_state") or "").upper()
    pr = (wt.get("pr_state") or "").upper()
    running = wt.get("dir") in running_dirs

    # REAP: PR merged/closed, OR issue closed (work done or abandoned).
    if pr in ("MERGED", "CLOSED") or issue == "CLOSED":
        return "REAP"
    # NO-PR: issue open, no PR discovered (or no issue number in the name).
    if issue == "OPEN" and not pr:
        return "NO-PR"
    # From here issue OPEN + PR OPEN.
    if running:
        return "KEEP"
    idle = wt.get("pr_idle_days")
    if idle is not None and idle > STALE_OPEN_IDLE_DAYS:
        return "STALE-OPEN"
    return "KEEP"


def build_measured(wt):
    """Was this worktree's `build/` actually measured?

    Separate from `build_gb() == 0.0` because a genuinely-measured empty build
    and an unmeasured one are different facts that happened to share a number.
    `unmeasured_builds` exists to tell an operator "the projection understates";
    counting a real 0.0 there reports missing data that is not missing."""
    v = wt.get("build_size_gb")
    return isinstance(v, (int, float)) and not isinstance(v, bool) and v >= 0


def build_gb(wt):
    """GB a reclaim of this worktree actually frees: its `build/` directory ONLY.

    `size_gb` is the whole worktree — source, .git, and build — and deleting
    `build/` frees none of the rest. An UNMEASURED build counts as 0.0 rather
    than falling back to `size_gb`, because the two errors are not symmetric:
    under-projecting only makes the supervisor keep deleting, while
    over-projecting makes it declare the target met and stop with the disk still
    full. That asymmetry is the whole finding."""
    v = wt.get("build_size_gb")
    if isinstance(v, (int, float)) and not isinstance(v, bool) and v >= 0:
        return float(v)
    return 0.0


def select(payload):
    """Classify every worktree, then — only under disk pressure — pick the
    STALE-OPEN build-reclaim set oldest-PR-first until the PROJECTED free would
    reach TARGET_FREE_GB. Pure: no filesystem, no gh calls."""
    free = payload.get("free_gb", 0)
    running = set(payload.get("running_dirs", []))
    worktrees = payload.get("worktrees", [])

    tiers = {"REAP": [], "KEEP": [], "STALE-OPEN": [], "NO-PR": []}
    for wt in worktrees:
        tiers[classify(wt, running)].append(wt)

    reclaim = []
    projected_cutoff = 0
    projected = free
    under_pressure = free < PRESSURE_GATE_GB
    critical = free < CRITICAL_GATE_GB
    if under_pressure:
        # Build-reclaim pool, oldest-PR-first (chains most likely truly abandoned
        # go first). Under routine pressure: only STALE-OPEN (idle > 14d) builds.
        # Under CRITICAL pressure (ENOSPC-imminent): also include idle KEEP builds
        # — an open PR touched within 14d but idle > CRITICAL_IDLE_DAYS with no
        # running session. This is the 7GB-fixer-build case a routine tick can't
        # touch; at <5GB free the crash risk outweighs the churn of one rebuild.
        # Reclaim is ALWAYS build/-only — the worktree, branch, PR are untouched;
        # cmake regenerates on resume. select() stays pure; the caller dispatches
        # the rm to the owning fixer.
        cands = [w for w in tiers["STALE-OPEN"] if w.get("has_build")]
        if critical:
            idle_keep = [
                w for w in tiers["KEEP"]
                if w.get("has_build")
                and w.get("dir") not in running
                and (w.get("pr_idle_days") or 0) > CRITICAL_IDLE_DAYS
            ]
            cands += idle_keep
        cands.sort(key=lambda w: w.get("pr_idle_days") or 0, reverse=True)

        # EVERY eligible candidate is returned, in priority order. The projected
        # cutoff is recorded as an INDEX, not enforced by truncating the list.
        #
        # This used to `break` once `projected >= TARGET_FREE_GB`, which made the
        # projection decide the list while the execution instructions
        # (reference.md) correctly tell the executor to stop on the MEASURED `df`.
        # Those two rules only agree while every estimate is exact. When a
        # deletion frees less than its `du` said — open file handles, hard links,
        # a build still growing — measured free stays under target and the
        # executor runs out of list, with eligible builds it was never given.
        # It then escalates to a human for disk it was holding the answer to.
        #
        # Returning the full list cannot over-delete: the executor re-measures
        # after each deletion and stops at the target. The projection's only job
        # is to say "this many should be enough", and it says so below.
        reclaim.extend(cands)
        projected_cutoff = len(cands)
        for i, w in enumerate(cands):
            if projected >= TARGET_FREE_GB:
                projected_cutoff = i
                break
            # build/ only — the reclaim deletes nothing else.
            projected += build_gb(w)

    summary = {
        "free_gb": free,
        "under_pressure": under_pressure,
        "critical": critical,
        "counts": {k: len(v) for k, v in tiers.items()},
        "reclaim_count": len(reclaim),
        # Sum of build/ sizes — what deleting this list would actually free.
        "reclaim_gb": round(sum(build_gb(w) for w in reclaim), 1),
        # Reclaims whose build/ was never measured. They are still dispatched
        # (deleting them can only help); they simply contribute 0 to the
        # projection, so a non-zero count here means reclaim_gb understates.
        "unmeasured_builds": sum(1 for w in reclaim if not build_measured(w)),
        # How far down `reclaim` the PROJECTION expects to get. Advisory only:
        # the executor walks the list until MEASURED `df` reaches target, which
        # may be sooner (estimates were conservative) or later (they were not).
        # Everything past this index is eligible headroom, not padding.
        "projected_sufficient_count": projected_cutoff,
        # A LOWER BOUND on where free space lands, never a result: re-measure
        # with `df` after each deletion and stop on the MEASURED number. Trusting
        # this figure is how a run stopped while still under ENOSPC pressure.
        "projected_free_gb": round(projected, 1),
        "projection_is_lower_bound": True,
        "thresholds": {
            "STALE_OPEN_IDLE_DAYS": STALE_OPEN_IDLE_DAYS,
            "PRESSURE_GATE_GB": PRESSURE_GATE_GB,
            "TARGET_FREE_GB": TARGET_FREE_GB,
            "CRITICAL_GATE_GB": CRITICAL_GATE_GB,
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
