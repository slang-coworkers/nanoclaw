---
title: "Worktree GC: never derive a branch name from the worktree dir — read it, or you reap live work"
type: learning
topic: misc
source: learnings/1785846721927-worktree-gc-never-derive-a-branch-name-from-the-wo.md
---

# Worktree GC: never derive a branch name from the worktree dir — read it, or you reap live work

A worktree-GC recipe that resolves PR state from a **derived** branch name (`wt-slang-<num>` → `fix/issue-<num>`) silently reaps live work. Audited on slang-fixer 2026-08-04: **9 of my worktrees** broke the assumption, 3 of them dangerously.

**The failure is directional and silent.** The derived name resolves to a *different, already-MERGED/CLOSED* PR while the real branch has an **OPEN** one → the tree looks terminal and gets reaped. Real cases:

| worktree | REAL branch → PR | derived name → PR |
|---|---|---|
| wt-slang-11917-b2 | `fix/issue-11917-batch2` → #12336 OPEN draft | `fix/issue-11917` → #11920 **MERGED** |
| wt-slang-11917-b3 | `fix/issue-11917-batch3` → #12281 OPEN | same #11920 **MERGED** |
| wt-slang-8125 | `fix/issue-8125-v2` → #12304 OPEN | `fix/issue-8125` → #11657 **CLOSED** |
| wt-slang-11967-runtime | `fix/issue-11967-runtime` → NO-PR | `fix/issue-11967` → #12081 **MERGED** |
| wt-slang-10918 | `dev/trilby/fix-10772` → #10918 OPEN draft | dir num ≠ issue num |
| wt-slang-12186 | `pr-12186` → NO-PR | non-`fix/` convention |

Suffix/naming conventions in real use that break derivation: `-batch2`/`-batch3`, `-v2`, `-resume`, `-runtime`, `-opt1`, `dev/<agent>/<slug>`, `pr-<n>`, and **dir number ≠ issue number**.

**Fix:** ground-truth the branch, never reconstruct it.
```bash
br=$(git -C "$wt" branch --show-current)        # or parse `git worktree list`
gh pr list -R <repo> --head "$br" --state all --json number,state,isDraft
```
**Two guards that catch all of the above regardless:** (1) NO-PR *or* any dir↔branch mismatch → ASSESS, never auto-reap; (2) refuse to reap a tree with uncommitted **tracked** changes.

**Safety facts that make reaps recoverable/decidable:**
- `git worktree remove --force` does NOT delete the branch ref — commits stay reachable in the main clone via `refs/heads/<branch>`. A failed `wip/reap` push is therefore not "work lost". (See also: the bot can't push branches touching `.github/workflows/*` — no `workflows` App permission.)
- "Dirty" on a merged/closed tree is usually throwaway: build logs, scratch `_*.md`, submodule-pointer drift (zero-line `M external/<sub>` diffs), regenerated-doc reformat churn. Inspect before assuming real work.
- Worktree GC reap is **operator-gated**; a `/supervise` auto-cron re-deriving the set is not the authorization.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785846721927-worktree-gc-never-derive-a-branch-name-from-the-wo.md`_
