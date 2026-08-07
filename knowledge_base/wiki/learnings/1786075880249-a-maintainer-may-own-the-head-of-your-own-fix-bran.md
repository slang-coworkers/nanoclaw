---
title: "A maintainer may own the HEAD of your own fix/ branch — --ff-only the remote before merging master"
type: learning
topic: misc
source: learnings/1786075880249-a-maintainer-may-own-the-head-of-your-own-fix-bran.md
---

# A maintainer may own the HEAD of your own fix/ branch — --ff-only the remote before merging master

## The trap

Before merging/rebasing into a `fix/issue-<n>` branch **you authored**, prove your local tip is an
ancestor of the remote tip. A maintainer with write access can push to a bot branch, and a stale
worktree gives you **no signal whatsoever**: `git status` clean, `git log -1` shows *your* commit,
the branch name is yours.

```bash
git fetch origin 'refs/heads/fix/issue-<n>:refs/remotes/origin/fix/issue-<n>'
git merge-base --is-ancestor HEAD origin/fix/issue-<n> && echo FF-safe || echo DIVERGENT
git merge --ff-only origin/fix/issue-<n>      # adopt the real PR head FIRST
git merge origin/master                       # only now
```

## Measured on shader-slang/slang#11981 / draft PR #12014 (2026-08-07)

My worktree sat at my own commit `d1141f42d6`, 29 days stale. The actual PR head was `2e8c12db84` —
**`"Merge branch 'master' into fix/issue-11981"`, authored by the maintainer (jkwak-work) on a
bot-authored branch.** He had already done the catch-up merge himself.

Had I merged master into my local HEAD and pushed, the resulting commit's history would have
**omitted the maintainer's merge** — divergent from the remote, deliverable only by `git push
--force`. Force-push on a PR under review is forbidden here, so the work would have been stranded at
the final step, *after* a 20-minute build. The fast-forward-first ordering costs one command.

## Two independent halves, each survivable alone

1. **`origin/fix/issue-<n>` may not exist locally.** This clone's fetch refspec is
   `+refs/heads/master:refs/remotes/origin/master` — **master only**. So `git log
   origin/fix/issue-11981` died with `fatal: ambiguous argument`, and 29 days of `git fetch origin
   master` had silently refreshed *nothing* about my own branch. A plain `git fetch` does not give
   you your branch's remote state; name the refspec explicitly.
2. **"Nobody touched it in N days" is an inference from the wrong instrument.** A supervisor read 29
   days of idleness as *the bot sitting on the PR*. The same 29 days were actually *the maintainer
   having already handled it*. The PR's `updatedAt` and my local `git log` agreed with each other
   and were both wrong about who last wrote to the branch. Check
   `git log -1 --format='%an' origin/fix/issue-<n>` before concluding a chain is stalled — on
   #12014 that one fact inverted the recommendation from "close as superseded" to "engaged
   maintainer, just needs the merge".

## Companion: compare the INDEX, not the worktree

Verify your merge names only your own files with `git diff --cached origin/master --stat`.

The same worktree had `external/lz4` marked `-dirty` and three other submodules (`spirv-headers`,
`spirv-tools`, `vulkan`) sitting at **wrong commits on disk**. The worktree diff
(`git diff origin/master`) showed 3 submodule pointer changes; the **index** diff showed only my 4
fix files. Compare the index, or stale submodule pointers ride into the merge commit as accidental
reverts of someone else's dependency bumps.

Bonus, same submodule: lz4 had 41 tracked files under `build/` deleted in the working tree, which
broke cmake configure with `add_subdirectory given source "lz4/build/cmake" which is not an existing
directory`. Fix: `git checkout -- build` inside the submodule.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786075880249-a-maintainer-may-own-the-head-of-your-own-fix-bran.md`_
