---
name: feedback_git_worktree_add_branch_moves_the_ref
description: "`git worktree add <dir> <branch>` CHECKS OUT the branch, so any commit/merge there MOVES the ref every later measurement resolves through. My PR-head ref silently advanced and a 5-file diff reported 503 files. Use `-d <sha>`."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 29108104-19da-446e-85bb-a01b2d15bc4d
---

# `git worktree add <dir> <branch>` moves the ref you are measuring against

**2026-08-10, reviewing nanoclaw#1169.** I fetched the PR head as a local branch
(`git fetch origin pull/1169/head:pr1169`), made a worktree at `pr1169`, and later made a *second*
worktree — also at `pr1169` — where I merged `origin/nv-main` to simulate the composed CI tree.

That merge committed **onto the checked-out branch**. `pr1169` advanced `550a19a88 → 361690877`.
Every subsequent `git diff --stat c7d5752d2 pr1169` then measured *PR head + all of nv-main*:

```
 503 files changed, 83782 insertions(+), 3716 deletions(-)     ← what I got
   5 files changed,   473 insertions(+),   50 deletions(-)     ← the real PR
```

**Caught by absurdity, not by a check.** 503 files for a PR the API reported as `changedFiles: 5` is
impossible; nothing in my process flagged it. Had the contamination been smaller — a few files —
it would have read as a legitimate diff and I would have reviewed content the author never wrote.

**Why it is easy to miss:** `git worktree add` prints `Preparing worktree (checking out 'pr1169')`
and `HEAD is now at 550a19a8` — reassuring, and true at that instant. The ref moves later, silently,
as a side effect of ordinary work in the worktree. A second `worktree add` on an
already-checked-out branch is refused, but the *first* one succeeds and hands you a live branch
pointer. Later `git branch -f` to repair also fails (`cannot force update the branch … checked out
at …`), so recovery needs `git reset --hard <sha>` **inside** the worktree.

**How to apply:**

- ⭐⭐⭐**Always `git worktree add -d <sha>` (detached) for review worktrees.** A detached HEAD cannot
  move the ref your measurements resolve through. Use a branch only when you intend to advance it.
- **Pin the SHA once, then measure against the SHA, never the ref name** — `git diff base..550a19a88`,
  not `base..pr1169`. Ref names are mutable; a 40-char SHA is not.
- ✅**Cheap recovery audit when you suspect drift:** compare *blob* hashes of the files you actually
  measured against the API-reported head — `git rev-parse <realhead>:<path> <movedref>:<path>`.
  Identical blobs mean the ref-move did not touch your conclusions; that is how I salvaged this
  review instead of redoing it (`fixture 0e3ed2c1`, `validator dd66d9a1`, `server.ts c5074765` all
  matched). **Then re-run the load-bearing measurements anyway**, after `git reset --hard`.
- ⭐⭐**Range-check every diff figure against the API's `changedFiles`/`additions` before reading
  content.** One `gh pr view --json changedFiles,additions,deletions` is the control that turns this
  class of contamination from invisible into obvious.

Related: [[feedback_a_stored_claim_re_shipped_as_a_live_finding]] (a figure whose premises were never
re-checked) — and the ANCHOR-A family, since this is the same shape: **a valid command run against
the wrong object produces a confident wrong number with no error.**
