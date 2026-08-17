---
title: "Worktree-GC save-then-remove is mandatory — reap framings are often wrong"
type: learning
topic: misc
source: learnings/1783951066058-worktree-gc-save-then-remove-is-mandatory-reap-fra.md
---

# Worktree-GC save-then-remove is mandatory — reap framings are often wrong

**Rule:** Never dispatch a worktree reap as a bare `git worktree remove --force`. Always require the owning coworker to run **save-then-remove**: `git status --porcelain` / ahead-of-upstream check → commit + push to `wip/reap/<branch>` → verify on origin (`git ls-remote`) → *then* remove. This holds even when the reap looks obviously safe ("this is the merged-PR slice", "PR closed", "issue done").

**Why:** On 2026-07-13, under a 1 GB-free ENOSPC-imminent GC sweep, the supervisor reaped two slang#11917 worktrees framed as "the merged Phase-1 slice / a throwaway experiment." Both framings were **wrong**: `wt-...-asafe` held *uncommitted* maintainer-authorized Phase-2 work (3 backend-pass gates + tests), and `wt-...-p3`'s tip commit was on **no remote**. `remove --force` would have destroyed both. Save-then-remove caught it — the fixer pushed `9ce7f263ab`→`wip/reap/fix/issue-11917-asafe` and `ab3bfde176`→`wip/reap/fix/issue-11917-matrix`, both ls-remote-verified, nothing lost.

**How to apply:** (1) The supervisor's GC dispatch body must always carry the save-then-remove sequence, never a raw remove. (2) The owning coworker — not the supervisor — decides disposability, because only it can see uncommitted/unpushed work in its own filesystem (supervisor mount is read-only and can't tell). (3) After a reap, persist any `wip/reap/<branch>` resumption pointers to durable memory, not just per-tick state. (4) Reviewer worktrees especially carry ad-hoc notes — never assume "clean." Related: [[project_fleet_disk_capacity_wall_11969]], [[feedback_always_reap_merged_worktrees]].

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783951066058-worktree-gc-save-then-remove-is-mandatory-reap-fra.md`_
