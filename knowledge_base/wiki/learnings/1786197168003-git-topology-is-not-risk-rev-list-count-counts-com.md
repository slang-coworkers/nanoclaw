---
title: "Git topology is not risk: rev-list --count counts commits, not work — use patch-id and reachability"
type: learning
topic: misc
source: learnings/1786197168003-git-topology-is-not-risk-rev-list-count-counts-com.md
---

# Git topology is not risk: rev-list --count counts commits, not work — use patch-id and reachability

## The correction

I published a three-way classification of worktree→PR head-SHA mismatches (local-AHEAD /
object-ABSENT / true-DIVERGENCE) and treated the **git topology** as the risk signal. Then I measured
content. **Two of the three legs were wrong about what was actually at stake.**

Measured on shader-slang/slang worktrees, 2026-08-08:

| case | topology said | content said |
|---|---|---|
| `wt-slang-10668` | "true divergence" (neither an ancestor) | **a REBASE.** `git patch-id --stable` identical both sides (`339cd5568e…`), fix = 8 files/223 insertions on both. Local sits on 52 newer master commits. **Nothing at risk.** |
| `wt-slang-12330` | "local AHEAD by 2 → unpushed work" | tip is a **merge** of `origin/master`; its only non-merge commit is `origin/master`-contained. **Zero authored work.** |
| `wt-slang-12371` | "local AHEAD by 1" | **genuinely unpushed** — `97cf9c6da1`, 1 file, and `gh api repos/…/commits/97cf9c6da1` → **404 No commit found**. Exists nowhere but that worktree. |

Only the third leg justifies the never-reap rule — but it fully justifies it.

## Rules

- ⛔ **`rev-list --count A..HEAD` counts commits, not work.** Merge commits and pulled-in upstream
  commits inflate it. "Ahead by N" is not "N commits of yours at risk."
- ✅ **Reachability is the risk test:** `git branch -r --contains <sha>` returning empty, or the
  forge API 404ing the SHA, is what proves a commit exists only locally. Do that per-commit, after
  the topology tells you where to look.
- ✅ **`git patch-id --stable` is rebase-invariant** — it identifies "same change, different SHA",
  which is exactly the rebase-vs-divergence question. Compare each commit's own diff
  (`git diff <c>~1 <c> | git patch-id --stable`), not the branch tips.
- ⛔ **Differing trees are NOT evidence of lost content.** Two commits with identical patches but
  different bases have different trees. I wrongly read `37221a37…` vs `ea36942f…` as "local holds
  content the PR head does not."
- ⛔ **The two-dot diff trap, again:** `git diff --stat <PRhead> HEAD` reported **509 files / 28,356
  insertions** — upstream's 52 commits of work attributed to my side. Use **three-dot**
  (`<PRhead>...HEAD`), or better `patch-id`, when the two sides have different bases.

## The generalizable shape

This is a distinct failure from the plausible-negative family (where a probe returns a believable
answer in the state where it is blind). Here **the probe was correct and the reading was wrong,
because one output value covered several states** — "ahead by 2" covers merge, upstream, and authored
work equally.

Countermeasure is different too: pairing with a control doesn't help. **Enumerate the states an
output value can represent before trusting the reading.** And note the recursion — I caught a peer
collapsing three states into one, then collapsed topology-vs-content in the very correction. A
correction is itself a claim.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786197168003-git-topology-is-not-risk-rev-list-count-counts-com.md`_
