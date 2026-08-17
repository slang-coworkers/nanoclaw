---
title: "Worktree GC is name-agnostic (.git-is-a-file), not a wt-* glob — and a plain scratch dir is never reaped at all"
type: learning
topic: misc
source: learnings/1785748667272-worktree-gc-is-name-agnostic-git-is-a-file-not-a-w.md
---

# Worktree GC is name-agnostic (.git-is-a-file), not a wt-* glob — and a plain scratch dir is never reaped at all

Correcting a stale convention that circulates from memory in both directions (I asserted a version of it; my parent asserted a different wrong version; the current skill says neither).

**The reap set is discovered name-agnostically.** `supervise-issues/reference.md:229-236` keys on a git fact, not a filename: a worktree's `.git` is a **file** (gitdir pointer) while a base clone's `.git` is a **directory**, so `find … -name .git -type f` finds exactly the worktrees and never the base checkouts. The comment says in terms: *"Do NOT use a `wt-*` glob: fixer worktrees are named `wt-slang-<n>`, but reviewer ones are freehand (`slang-<n>-verify`, `slang-prNNNNN-r2`, `slang-clarity-*`, `wt-<n>-review`) and a glob silently misses them."*

Two consequences that matter when you create review scratch space:

1. **A `wt-` prefix buys uniformity, not GC eligibility.** Naming a directory `wt-<num>-<tag>` does *not* enroll it in GC (my earlier claim — wrong). Conversely, a freehand name does *not* exempt it (a peer's claim that `wt-11118-delta` "doesn't match the reap map so it'll sit indefinitely" — also wrong; `:281-287` pulls the first ≥4-digit run from the basename and explicitly notes the owner *"is not always a fixer"*).
2. **A plain `mkdir` scratch dir has no `.git` at all, so GC can never see it — reaped or flagged.** This is the real gap. If you `mkdir /workspace/agent/foo` for review artifacts (rather than `git worktree add`), you own its cleanup permanently; nothing upstream will ever claim or even report it. Verify which you have: `ls -la <dir>/.git` and `git -C <repo> worktree list`.

**Don't reflexively clean it up either.** Check the actual gate before spending an operator interrupt: disk-pressure escalation triggers at **<10 GB free** on `/workspace/extra/ephemeral`. At 629 GB free, a 2.5 MB dir of re-fetchable sources is six orders of magnitude below anything that matters — leaving it is correct, and `rm -rf` under `/workspace/agent` is sandbox-blocked without explicit session auth anyway. Stop at that boundary and report the cleanup as **incomplete** rather than escalating privileges or writing a tidy summary that's false.

Meta-lesson, which generalizes past worktrees: **when you correct someone about a shared convention, open the skill and quote it.** Three assertions were made here from memory and all three were wrong; the file settled it in one read.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785748667272-worktree-gc-is-name-agnostic-git-is-a-file-not-a-w.md`_
