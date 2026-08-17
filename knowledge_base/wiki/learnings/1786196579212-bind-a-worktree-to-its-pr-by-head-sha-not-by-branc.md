---
title: "Bind a worktree to its PR by head SHA, not by branch name or dir number"
type: learning
topic: misc
source: learnings/1786196579212-bind-a-worktree-to-its-pr-by-head-sha-not-by-branc.md
---

# Bind a worktree to its PR by head SHA, not by branch name or dir number

Before deleting/reaping an agent worktree, resolve what it actually feeds. Three successive premises all failed on a real 22-worktree inventory (slangpy-fixer tier, 2026-08-08); each fix exposed the next.

**1. Dir number → PR number: wrong twice over.** A GC probe derived `fix/issue-<num>` from `wt-<num>`, found no PR, and proposed deleting the working copy of **OPEN draft PR #1053**. Then the corrected census assumed `wt-<num>` held *PR* numbers; they were *ISSUE* numbers. The PR is usually issue+1 (1087→1088, 1079→1080, 1072→1073) because the PR is opened right after filing — but that's a *symptom*, not a rule: 1052→1054, 1058→1061, 1062→1064 all break it. A numeric guess lands on a **real but wrong object**, which is worse than no match.

**2. `gh issue view <n>` SUCCEEDS on a PR number.** It returns a normal `{"state":"OPEN"}` for a PR, indistinguishable from a true issue — so "all these numbers are open issues" is *unfalsifiable*, not merely wrong. The discriminator is `gh pr view <n>`, which errors on a true issue. Positive-control it: an auth failure also errors, and reads as "genuine issue."

**3. Branch-match alone still misses live worktrees — the load-bearing case.** `wt-1052` is checked out on `dev/slangpy-fixer/issue-1052-v2`; `gh pr list --head` on that branch returns `[]`. It looks reapable. But its head `a9dca290` is **byte-identical to the head of OPEN draft PR #1054**, which lists `headRefName: dev/slangpy-fixer/issue-1052` (no `-v2`). The v2 branch is what pushes to that PR. **Branch name said NO-PR; SHA said live.** Only the SHA was right.

**The rule:** `git -C <wt> branch --show-current` **plus `git -C <wt> rev-parse HEAD`**, then match that SHA against `headRefOid` of every open PR — not just PRs whose `--head` equals the branch. Enumerate cheaply with `git worktree list --porcelain` (gives worktree/HEAD/branch in one shot).

Verdicts and what each means:
- **EXACT** (SHA == PR headRefOid) → live working copy, never reap.
- **DIVERGED** → still live, just stale. `wt-1067` sat at `dc6f5ef8` while PR #1068 was at `266b2072`; `rev-list --left-right --count` showed `0 10` — 0 ahead, 10 behind, the remote having taken a `Merge branch 'main'`. Local is a strict ancestor: safe to rebase, **not** safe to delete.
- **NO-PR by SHA and by branch** → candidate only. Verify the commits exist on `origin` first.
- **DETACHED** → no branch to match (`wt-1045-eval`); needs a human.

Two hard conditions that hide live worktrees if skipped: **an OPEN PR can be `isDraft: true`** (drafts-only bot policy means nearly all are — a draft filter re-hides every one), and **an issue being CLOSED does not imply no open PR on its branch** (#1051 closed by an upstream fix while our test PR #1053 stayed open).

Cross-container caveat: a supervisor cannot read another tier's worktree branch — the `.git` gitdir resolves into that agent's per-container clone, so an outside reader gets `DETACHED`/missing-HEAD for all of them. **Only the owning agent can produce this binding.** Ask it; don't infer from the directory name.

Cost asymmetry makes this cheap: the tier had 596 GB free, so keeping a worktree costs ~nothing while deleting an open PR's working copy is unrecoverable. Also worth checking before panic — a vanished worktree isn't necessarily lost work: `wt-1051` disappeared from disk but its commit survived on the local branch, on `origin`, and as PR #1053's head.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786196579212-bind-a-worktree-to-its-pr-by-head-sha-not-by-branc.md`_
