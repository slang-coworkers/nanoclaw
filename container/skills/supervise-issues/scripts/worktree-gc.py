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

Pure I/O split (mirrors pull-universe.sh → scan.py): the caller resolves each
worktree's gh state and passes it in as JSON; `classify()` and `select()` are
pure and tested by test_worktree_gc.py. Input schema (stdin or --in):

  {
    "free_gb": 2,
    "running_dirs": ["wt-slang-12073", ...],   # dirs with a live/running session
    "worktrees": [
      {"dir": "wt-slang-11511", "size_gb": 6.7, "has_build": true,
       "issue_state": "OPEN", "pr_state": "OPEN", "pr_idle_days": 34},
      ...
    ]
  }

Output: {"tiers": {...}, "reclaim": [...], "summary": {...}} — `reclaim` is the
ordered STALE-OPEN build-reclaim dispatch list (empty unless under pressure).

Run: python3 scripts/worktree-gc.py < payload.json
Test: python3 scripts/test_worktree_gc.py
"""

import json
import sys

# ─── Thresholds — the ONLY place these live. Markdown references them by name. ───
STALE_OPEN_IDLE_DAYS = 14   # PR untouched longer than this + no running session → STALE-OPEN
PRESSURE_GATE_GB = 25       # only reclaim STALE-OPEN builds when free < this
TARGET_FREE_GB = 40         # stop reclaiming once free would reach this
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


def select(payload):
    """Classify every worktree, then — only under disk pressure — pick the
    STALE-OPEN build-reclaim set oldest-PR-first until free would reach
    TARGET_FREE_GB. Pure: no filesystem, no gh calls."""
    free = payload.get("free_gb", 0)
    running = set(payload.get("running_dirs", []))
    worktrees = payload.get("worktrees", [])

    tiers = {"REAP": [], "KEEP": [], "STALE-OPEN": [], "NO-PR": []}
    for wt in worktrees:
        tiers[classify(wt, running)].append(wt)

    reclaim = []
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
        projected = free
        for w in cands:
            if projected >= TARGET_FREE_GB:
                break
            reclaim.append(w)
            projected += w.get("size_gb", 0)

    summary = {
        "free_gb": free,
        "under_pressure": under_pressure,
        "critical": critical,
        "counts": {k: len(v) for k, v in tiers.items()},
        "reclaim_count": len(reclaim),
        "reclaim_gb": round(sum(w.get("size_gb", 0) for w in reclaim), 1),
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
