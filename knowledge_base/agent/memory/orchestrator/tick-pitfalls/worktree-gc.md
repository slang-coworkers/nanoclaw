---
type: runbook
description: Worktree-GC pitfalls of the /supervise-issues tick — wt-dirs.txt build, gc payload shape, free-space trend, REAP shape, hardcoded bg-script paths (ticks 280-356).
---

Worktree-GC traps for the tick pipeline. Parent: [[orchestrator/supervise-tick-pull-pitfalls.md]].

- **Build `wt-dirs.txt`** with `find /workspace/extra/ephemeral/prod-groups -maxdepth 3 -mindepth 3 -name .git -type f`
  (worktrees sit at `prod-groups/<folder>/<wt>/.git`; `-maxdepth 2` finds 0 — tick 280). Drop submodule `.git` files
  (gitdir containing `/modules/`), and re-filter to paths whose `.git` still exists right before `gc_resolve.py` — it
  crashes if a worktree vanishes mid-tick (tick 289, `slang-triager/wt-13603-bisect`).
- **`worktree-gc.py` reads stdin only** (`--in` is ignored; it hangs). Build the payload from `wt-resolved.json`'s `path`
  field, not `dir` (the basename — every size lookup missed).
- **The payload since tick 280 omits `kind`/`idle_days`.** Without them only closed/merged trees are reaped (12 at tick
  290); with them (`kind` from the `wt-<repo>[-pr]-<n>` name, `idle_days` from dir/build mtimes) scratch trees idle > 2 d
  go too (45). Open question: decide once which input is right before comparing tick-to-tick counts.
- **Read the free-space trend from a tier's `.worktree-gc/history.log`, not one `df`** (tick 324: 681→232 GB in 12 h, 9.4% at 00:07Z, 313 GB at 00:2xZ; every tier reaped 0). The tier GC only covers the six prod tiers: `eval-slang-*` groups have no worktree-gc task, and `eval-slang-reviewer` alone held 328 GB. `du -sh prod-groups/*` names the consumer; that goes to the operator, since the supervisor never reaps.
- Common REAP shape: merged-PR reviewer worktrees (`wt-<pr>-verify/-revA/-base/-master`), owned by the reviewer
  session on the chain whose `pr.number` matches (or the `slang-ci-nightly-*` thread for nightly-PR chains).

- **The copied `bg*.sh`/`run-pull.sh` batch scripts hardcode `cd /workspace/agent/tick<NNN>` of the tick they were written in** (measured tick 356, 2026-11-17: bgall.sh still said `cd tick355`, so runs/ci/titles/gc wrote fresh outputs into the PREVIOUS tick's dir — harmless, but the new tick found no ci.json and tick355's intermediates were clobbered). After copying helpers, `sed -i '1s|.*|cd "$(dirname "$0")"|' bg*.sh run-pull.sh ghfeeds.sh` (tick 356 already fixed its copies, so ticks ≥357 inherit the relative form). Also `setsid` background launches survive tool-call timeouts, but a launch call killed inside its first ~15 s can take the child with it — after launching, verify the PID is alive before waiting on the done-files.
