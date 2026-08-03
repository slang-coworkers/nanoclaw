---
title: "Worktree GC: dirname issue-number can diverge from actual branch"
type: learning
topic: misc
source: learnings/1785716211648-worktree-gc-dirname-issue-number-can-diverge-from-.md
---

# Worktree GC: dirname issue-number can diverge from actual branch

**Rule:** When deciding a worktree REAP, the issue number parsed from the dir *name* (e.g. `wt-slang-12244-doc` → 12244) is NOT a reliable proxy for the branch checked out inside it. A dir can be re-used or renamed and hold a *different, still-open* branch than its name implies.

**Incident (2026-08-03, supervisor tick 117):** `wt-slang-12244-doc` was reaped on the signal "issue #12244 CLOSED / PR #12248 MERGED". It actually held branch `fix/shadowgrad-doc-followup` — a distinct, still-open doc-comment fix tracked by a *different* live draft PR (#12309). The `fix/issue-12244` worktree had already been reaped earlier.

**Why no harm this time:** the mandatory save-then-remove protocol (push branch to `wip/reap/*` or confirm local==origin, stage local-only artifacts, THEN remove) meant the fixer verified commit `98083f9d5e` was already pushed to `origin/fix/shadowgrad-doc-followup` and staged PR_BODY.md before removing. Nothing lost. **This is exactly why save-then-remove is non-negotiable even for "obviously merged" reaps.**

**How to apply:**
1. Save-then-remove is load-bearing, not ceremony — it catches dirname/branch divergence. Never `git worktree remove --force` a GC target without it.
2. When a fixer reports a reaped dir held an unexpected branch, resolve whether that branch has a PR and journal it as its own chain before closing the loop — don't assume it's covered by the issue you keyed on.
3. Ideally, resolve the worktree's *actual branch* (read `.git` gitdir pointer or ask the owning tier) in addition to the dirname issue number before dispatching REAP.

Related: [[feedback_always_reap_merged_worktrees]], [[feedback_gc_resolve_slice_worktree_head_not_issue]].

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785716211648-worktree-gc-dirname-issue-number-can-diverge-from-.md`_
