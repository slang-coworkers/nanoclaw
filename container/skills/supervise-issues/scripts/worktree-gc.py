#!/usr/bin/env python3
"""worktree-gc.py — deterministic worktree reclaim classifier.

Every group whose directory holds per-task work runs `worktree-gc-run.sh` as the
gate of its hourly `worktree-gc` task inside its own container (the host keeps
that task on every such group: src/modules/worktree-gc/index.ts); that script
collects facts with
`worktree-gc-discover.py`, resolves issue/PR state with `gh`, and hands the set
to this module. The supervisor's §8 only reads the reports. The thresholds below
are the single source of truth: SKILL.md / reference.md / worktree-gc-run.sh
reference them by name (the run script reads them from `summary.thresholds`)
and never restate the numbers.

A checkout is any tree the discovery found: a linked worktree, a standalone
clone, an orphan (a `.git` file whose administrative directory git has pruned)
or a plain directory under a `wt-*` name. The tiers below apply to every shape;
`shape` only matters where the executor could not save the tree before removing
it (see `classify`).

Four tiers:

  REAP        remove the worktree (after saving uncommitted work to a local
              `wip/reap/<name>` branch). Primary fix trees whose PR is
              MERGED/CLOSED, or whose issue is CLOSED with no PR; primary trees
              with no PR idle > NOPR_IDLE_DAYS; every scratch tree whose PR is
              MERGED/CLOSED or that is idle > SCRATCH_IDLE_DAYS.
  STALE-OPEN  primary tree whose PR is OPEN but idle > STALE_OPEN_IDLE_DAYS:
              reclaim the regenerable `build/` in place, never the worktree.
  KEEP        every reference clone, anything with a running session,
              anything touched within MIN_IDLE_DAYS, scratch trees still in use,
              open PRs still active,
              any checkout another checkout borrows objects from, that owns a
              live linked worktree, or whose git directory holds another
              checkout's submodule repositories (`dependents`), and any tree whose work the
              executor has no way to save: a plain directory, or an orphan
              whose repository is gone.
  NO-PR       primary tree, issue OPEN, no PR yet, not idle enough to reap.

`kind` is one of three. A primary tree is a tier's fix checkout (`wt-slang-<n>`,
`wt-slangpy-<n>`, `wt-slang-pr-<n>`, …). A scratch tree is every other `wt-*`
or per-task-named checkout (`wt-<n>-verify`, `wt-<n>-master`, `wt-<n>-revA`,
`wt-clarity-*`, `review-<n>`), and every other top-level checkout whose name
carries an issue or PR number (`slang-13742-pr`, `falcor-13876`,
`rev-1179-base`); it holds no work the PR does not already hold. A reference
clone is a top-level standalone clone or bare repository whose name carries no
number (`spec`, `SPIRV-Tools`, `slang-playground`, `r0-origin.git`): a
repository the group reads or builds from. It is always KEEP. Nothing would
clone it again (the boot refresh in refresh-clones.ts only fast-forwards clones
that exist), and its git history is no measure of use: a group can read it
every day without moving HEAD. The run lists every reference clone in its report
under `references`, with its size and idleness, and flags one at least
REFERENCE_LARGE_GB that has been idle REFERENCE_DORMANT_DAYS (`dormant_large`)
for the operator; nothing removes it automatically.
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

Three more kinds of per-task output are expired by one rule (`expired_entry`):
idle longer than RUNS_RETENTION_DAYS, held by no process, and borrowed from by
no checkout, most idle first.

  runs          entries of the group's `runs/` directory, where the review
                runners and the agent keep run output (run logs, combined
                reviews, verify builds)            → `runs_expired`
  scratch_dirs  top-level directories whose name matches SCRATCH_DIR_PATTERNS:
                the per-task work directories agents create next to their
                checkouts (`review-14416`, `devin-13619-r2`, `B-13514`,
                `bare-13387.git`, `scratch-12001`, `repro-881`)
                                                   → `scratch_expired`
  wt_files      top-level regular files named `wt-*`, the build and configure
                logs agents write next to a checkout (`wt-12249-build.log`)
                                                   → `files_expired`

A scratch directory that holds git repositories is still expired; the executor
saves each repository first, as it does for a checkout.

Input (stdin):

  {
    "free_gb": 2, "total_gb": 2481,
    "running_dirs": ["wt-slang-12073", ...],
    "worktrees": [
      {"dir": "wt-slang-11511", "kind": "primary", "shape": "worktree",
       "idle_days": 3, "size_gb": 6.7, "build_size_gb": 4.1, "has_build": true,
       "issue_state": "OPEN", "pr_state": "OPEN", "pr_idle_days": 34,
       "dependents": [], "owner_exists": true},
      ...
    ],
    "runs": [{"name": "A-14412-r1", "idle_days": 20, "running": false, "dependents": []}]
  }

Output: {"tiers": {...}, "reclaim": [...], "runs_expired": [...],
"scratch_expired": [...], "files_expired": [...], "references": [...],
"summary": {...}}.
Each worktree gets a `gc_reason` string explaining its tier.

Run: python3 scripts/worktree-gc.py < payload.json
Test: python3 scripts/test_worktree_gc.py
"""

import json
import re
import sys

# ─── Thresholds — the ONLY place these live. Markdown references them by name. ───
STALE_OPEN_IDLE_DAYS = 14   # open PR untouched longer than this → STALE-OPEN (build/ reclaimed)
SCRATCH_IDLE_DAYS = 2       # scratch tree idle longer than this → REAP
NOPR_IDLE_DAYS = 30         # primary tree with no PR idle longer than this → REAP
REFERENCE_LARGE_GB = 20     # a reference clone at least this large …
REFERENCE_DORMANT_DAYS = 30  # … and idle this long is flagged `dormant_large` for the operator (never removed)
MIN_IDLE_DAYS = 1           # nothing touched within this many days is reaped or reclaimed
PRESSURE_GATE_PCT = 25      # free below this share of the volume → idle KEEP builds join the reclaim list
PRESSURE_IDLE_DAYS = 7      # under pressure, a KEEP build whose PR is idle > this is reclaimable
TARGET_FREE_PCT = 30        # projection target once under pressure (hysteresis above the gate)
CRITICAL_GATE_PCT = 2       # free below this share → ENOSPC-imminent
CRITICAL_IDLE_DAYS = 2      # under critical pressure, a KEEP build idle > this is reclaimable
RUNS_RETENTION_DAYS = 14    # a runs/ entry untouched longer than this is expired
SAVE_MAX_MB = 200           # untracked content larger than this is not committed; the tree is skipped
ESCALATE_PCT = 10           # free below this share of the volume after a run → the gate wakes the agent

FINAL_PR_STATES = ("MERGED", "CLOSED")

# Top-level directories that are the agent's durable state, never per-task work,
# whatever they hold. The base clones are durable too; discovery owns their names
# (BASES) because it walks their worktrees.
DURABLE_DIRS = ("memory", "tools", "tasks", "conversations", "runs", "active-work", "plugins")


def is_durable_dir(name):
    """Is a top-level directory the agent's durable state: a DURABLE_DIRS name, a
    `venv-*` environment, or a hidden directory (`.worktree-gc`, `.claude`)?"""
    return name in DURABLE_DIRS or name.startswith(("venv-", "."))


# Top-level per-task scratch directories, as agents name them: a per-task word and
# the issue/PR number (`review-14416`, `review-14416-r2-devin`, `B-13514-r2`,
# `pr12249-review`, `ci-1181`), a bare clone a review cloned its checkouts from
# (`bare-13387.git`), or a directory named as disposable (`scratch-…`, `repro-…`,
# `tmp-…`). Full-match regexes; durable directories (`is_durable_dir`, the base
# clones) match none of them.
PER_TASK_WORDS = (
    "review", "reviewA", "reviewB", "reviewC", "reviewerA", "reviewerB", "reviewerC",
    "revA", "revB", "revC", "runA", "runB", "runC", "A", "B", "C", "devin", "pr",
    "probe", "probes", "critique", "codex", "drafts", "verify", "spike", "measure",
    "ci", "ab", "ctl", "rel", "ubsweep",
)
SCRATCH_DIR_PATTERNS = (
    r"(?:" + "|".join(PER_TASK_WORDS) + r")-?[0-9]{3,}(?:[-._][^/]*)?",
    r"bare-[0-9]{3,}\.git",
    r"(?:scratch|repro|tmp)-[^/]+",
    r"(?:scratch|tmp)[0-9]+[^/]*",
)
_SCRATCH_DIR = re.compile("|".join(f"(?:{p})" for p in SCRATCH_DIR_PATTERNS))


def is_scratch_dir(name):
    """Is a top-level directory named like an agent's per-task scratch directory?"""
    return bool(_SCRATCH_DIR.fullmatch(name))


def _idle(wt):
    v = wt.get("idle_days")
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def classify(wt, running_dirs):
    """Pure per-worktree tier decision; also sets wt["gc_reason"]. No pressure or
    size logic here — that is select()'s job."""
    issue = (wt.get("issue_state") or "").upper()
    pr = (wt.get("pr_state") or "").upper()
    running = wt.get("dir") in running_dirs or bool(wt.get("running"))
    kind = wt.get("kind") or "primary"
    idle = _idle(wt)
    scratch = kind == "scratch"

    def tier(name, why):
        wt["gc_reason"] = why
        return name

    dependents = wt.get("dependents") or []
    shape = wt.get("shape") or "worktree"

    if kind == "reference":
        return tier("KEEP", "reference clone")
    if dependents:
        return tier("KEEP", "used by " + ", ".join(sorted(dependents)))
    if running:
        return tier("KEEP", "running session")
    if shape == "plain":
        return tier("KEEP", "not a git checkout; nothing can save its contents")
    if shape == "orphan" and not wt.get("owner_exists"):
        return tier("KEEP", "orphaned and its repository is gone; nothing can save its contents")
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


def expired_entry(entry):
    """Is this per-task output (a `runs/` entry, a scratch directory, a `wt-*`
    file) past RUNS_RETENTION_DAYS, held by no process and borrowed from by no
    checkout? An entry without a measured idleness is kept."""
    idle = _idle(entry)
    return (
        idle is not None
        and idle > RUNS_RETENTION_DAYS
        and not entry.get("running")
        and not entry.get("dependents")
    )


def dormant_large(ref):
    """Is a reference clone (a `references` entry with a measured `size_gb`) at
    least REFERENCE_LARGE_GB and idle at least REFERENCE_DORMANT_DAYS? The
    supervisor escalates such a clone to the operator; nothing removes it."""
    size, idle = ref.get("size_gb"), _idle(ref)
    return (
        isinstance(size, (int, float)) and not isinstance(size, bool)
        and size >= REFERENCE_LARGE_GB
        and idle is not None and idle >= REFERENCE_DORMANT_DAYS
    )


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
    runs = payload.get("runs", [])
    scratch_dirs = payload.get("scratch_dirs", [])
    wt_files = payload.get("wt_files", [])

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

    def expired(entries):
        return sorted((e for e in entries if expired_entry(e)), key=lambda e: e.get("idle_days") or 0, reverse=True)

    runs_expired = expired(runs)
    scratch_expired = expired(scratch_dirs)
    files_expired = expired(wt_files)
    shapes, kinds = {}, {}
    for w in worktrees:
        shapes[w.get("shape") or "worktree"] = shapes.get(w.get("shape") or "worktree", 0) + 1
        kinds[w.get("kind") or "primary"] = kinds.get(w.get("kind") or "primary", 0) + 1
    references = [
        {"name": w.get("dir"), "path": w.get("path"), "shape": w.get("shape"), "idle_days": w.get("idle_days")}
        for w in worktrees if w.get("kind") == "reference"
    ]

    summary = {
        "free_gb": free,
        "total_gb": total,
        "free_pct": free_pct,
        "target_free_gb": round(target_gb, 1) if target_gb is not None else None,
        "under_pressure": under_pressure,
        "critical": critical,
        "counts": {k: len(v) for k, v in tiers.items()},
        "shapes": shapes,
        "kinds": kinds,
        "references_count": len(references),
        "runs_count": len(runs),
        "runs_expired_count": len(runs_expired),
        "scratch_dirs_count": len(scratch_dirs),
        "scratch_expired_count": len(scratch_expired),
        "wt_files_count": len(wt_files),
        "files_expired_count": len(files_expired),
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
            "REFERENCE_LARGE_GB": REFERENCE_LARGE_GB,
            "REFERENCE_DORMANT_DAYS": REFERENCE_DORMANT_DAYS,
            "MIN_IDLE_DAYS": MIN_IDLE_DAYS,
            "PRESSURE_GATE_PCT": PRESSURE_GATE_PCT,
            "PRESSURE_IDLE_DAYS": PRESSURE_IDLE_DAYS,
            "TARGET_FREE_PCT": TARGET_FREE_PCT,
            "CRITICAL_GATE_PCT": CRITICAL_GATE_PCT,
            "CRITICAL_IDLE_DAYS": CRITICAL_IDLE_DAYS,
            "RUNS_RETENTION_DAYS": RUNS_RETENTION_DAYS,
            "SAVE_MAX_MB": SAVE_MAX_MB,
            "ESCALATE_PCT": ESCALATE_PCT,
        },
    }
    return {
        "tiers": tiers,
        "reclaim": reclaim,
        "runs_expired": runs_expired,
        "scratch_expired": scratch_expired,
        "files_expired": files_expired,
        "references": references,
        "summary": summary,
    }


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
