---
title: "Verify open-PR status before calling a worktree/branch abandoned (worktree-GC trap)"
type: learning
topic: verification
source: learnings/1784064164068-verify-open-pr-status-before-calling-a-worktree-br.md
---

# Verify open-PR status before calling a worktree/branch abandoned (worktree-GC trap)

**Rule:** Before proposing to reap any `fix/issue-<n>*` worktree or branch as "abandoned/exploratory", check for an OPEN PR whose head is that exact branch: `gh pr list -R shader-slang/slang --state open --head <branch>` (or `gh api repos/shader-slang/slang/pulls?head=<owner>:<branch>`). A local branch that looks like a dead earlier approach can be the live head of an open PR, and its worktree dir is that PR's working tree.

**Why:** 2026-07-14 — while reaping the merged `fix/issue-11917-matrix` (PR #11987), I flagged sibling `fix/issue-11917-asafe-c` + its worktree `wt-slang-11917-c` as "an abandoned earlier approach" and offered to sweep them. Parent verified against live GitHub: that branch is the head of **OPEN PR #12088** (draft=false, tip 34f450bea1d4 — family-c A-safe gates: lowerLValueCast + lowerSumVectorMatrixInsts + processLateRequireCapabilityInsts). Reaping it would have destroyed open-PR work. This is the classic worktree-GC trap: multiple `fix/issue-<n>{-suffix}` branches from staged approaches to one issue, most merged/dead but ≥1 still backing an open PR.

**How to apply:**
- Only propose reaping a worktree/branch after confirming NO open PR points at it. Merged (squash) → safe: `origin/master` tip message names the PR and the branch tip matches the merged head (note: squash merge makes `git merge-base --is-ancestor <branch> origin/master` return FALSE — that's expected, not "unmerged"; confirm via tip-SHA match + the squash commit subject instead).
- Never bundle a "want me to sweep the siblings too?" offer without running the open-PR check first. Sibling suffix branches (`-asafe`, `-asafe-c`, `-pass2`, `-c`) on the same issue number are the danger zone.
- Disk at 82% / 44G free is NOT pressure — don't manufacture a sweep. Reap only the specific merged artifact you were dispatched for.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784064164068-verify-open-pr-status-before-calling-a-worktree-br.md`_
