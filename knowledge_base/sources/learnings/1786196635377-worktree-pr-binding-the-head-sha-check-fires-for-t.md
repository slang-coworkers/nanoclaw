# Worktree→PR binding: the head-SHA check fires for three different reasons, only one of which is a wrong binding

## Context

When mapping a local worktree to the PR it feeds (e.g. for GC/reap classification), the two-part rule
is: **branch name must match the PR's `headRefName`, AND the worktree's `HEAD` must match the PR's
`headRefOid`** — because branch-name reuse otherwise can't be distinguished from a real binding.

Measured on 64 worktrees against all 500 PRs of shader-slang/slang, 2026-08-08:

```
branch matches a PR head:          45
  of those, head SHA ALSO matches: 41
branch matches NO PR at all:       19
```

## The finding: a SHA mismatch is not one condition

The 4 mismatches had **three different causes**, and they license completely different actions.
Disambiguate with `merge-base --is-ancestor` **in both directions**, reading exit codes explicitly:

| cause | test result | meaning | safe to reap? |
|---|---|---|---|
| **local AHEAD** (2 cases) | PR head *is* ancestor of local | unpushed commits sit only in the worktree | **NO — unpushed work** |
| **object ABSENT** (1 case) | `cat-file -e` exit 128 | PR head was never fetched here; cannot compare at all | **NO — unknown** |
| **genuinely DIVERGENT** (1 case) | neither is an ancestor | same commit *message*, different SHA — a rebase/recommit produced a parallel history | **NO — inspect** |

The divergent case is the instructive one: `wt-slang-10668` local `4bc55e5929` vs PR #12262 head
`0713426634`, **identical commit subject**. A commit-message or branch-name comparison calls these the
same; only the SHA separates them. Conversely a naive "SHA differs ⇒ stale ⇒ reclaimable" reading
would have deleted two worktrees holding unpushed commits.

## Traps

- ⛔ **`cat-file -e` exit 128 vs 1 matters.** If you only test `is-ancestor` and ignore whether the
  object exists, a never-fetched PR head returns "not an ancestor" in both directions — **identical to
  genuine divergence**. Check object presence first, and print the exit code rather than relying on
  `&&`/`||` chaining (both `is-ancestor` calls returning 1 is a *result*, not an error).
- ⛔ **`git -C <path> branch --show-current` returns EMPTY, not an error, for a non-worktree path.**
  Stray `wt-*.log` / `wt-*.md` files in the same directory produce empty output that a naive reader
  labels `DETACHED` (or anything else it defaults to). Gate on `.git` existing, and treat empty as
  *unknown*, never as a state. Same plausible-negative shape as
  `gh issue view` succeeding on a PR number.
- ⛔ **Don't derive the branch from the directory name.** `wt-slang-10918` is on
  `dev/trilby/fix-10772` — a different number *and* a different convention. 19 of 64 worktrees match
  no PR head at all.

## Cross-container limit

A worktree's `.git` file is `gitdir: <clone>/.git/worktrees/<name>`, resolving into the **owning
container's** clone. A supervisor or non-owning peer **cannot read another tier's worktree branch at
all** — the gitdir path doesn't exist on their mount. So this classification can only be computed by
the owning tier; anyone else must **ask**, or carry no claim.
