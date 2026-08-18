---
title: "git stash is per-CLONE, not per-worktree — a bare `stash pop` in wt-<x>/ takes a SIBLING session's stash"
type: learning
topic: agent-ops
source: learnings/1786032031180-git-stash-is-per-clone-not-per-worktree-a-bare-sta.md
---

# git stash is per-CLONE, not per-worktree — a bare `stash pop` in wt-<x>/ takes a SIBLING session's stash

## The trap

Worktree isolation covers files, branches, and HEAD. It does **not** cover the stash list, which is
a single ref namespace (`refs/stash`) shared by **every worktree of the clone**.

So in `wt-slang-12383/` I ran:

```bash
git stash push -- source/slang/slang-emit.cpp   # → "No local changes to save" (patch was COMMITTED)
...
git stash pop                                   # → popped stash@{0}: "WIP on fix/issue-11944"
```

The push saved nothing, so the pop took whatever a **sibling session** had pushed last — dropping
another session's `tests/spirv/varying-out-index-sv-target.slang` (129 lines) into my tree as a
`modify/delete` conflict.

**Their work survived only because the conflict made git keep the entry** ("The stash entry is kept
in case you need it again"). A clean pop would have *removed* a peer's stash and left them with the
files silently merged into someone else's worktree. That is data loss for the other session, caused
by a command that looks entirely local.

## What to do instead

To temporarily revert a **committed** change in a worktree, use worktree-local checkout:

```bash
git checkout HEAD~1 -- path/to/file    # revert arm
git checkout HEAD   -- path/to/file    # restore
```

For genuinely uncommitted work, `git stash push` **with an explicit pathspec** followed by
`git stash pop stash@{0}` is still risky under concurrency — a sibling can push between your two
commands. Prefer `git diff > /tmp/mine.patch` + `git apply -R` / `git apply`, or a scratch commit.

## Two second-order lessons

1. **A no-op stash push turns the matching pop into a pop of someone else's work.** Always check the
   push actually saved something ("No local changes to save" is the tell) before popping. Better:
   never pair a bare `pop` with a conditional `push`.
2. **"Never touch a sibling's worktree" can be obeyed literally while reaching their data through a
   shared namespace.** The isolation rule is about *paths*; the hazard is any per-clone resource —
   the stash, `refs/`, config, hooks, `.git/objects`. Ask what the resource is scoped to, not whether
   your command mentions their directory.

Diagnostic if you suspect you hit this: `git stash list` shows entries labelled with **other
branches** (`WIP on fix/issue-<other-number>`), and `git status` shows unmerged paths you never
touched.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786032031180-git-stash-is-per-clone-not-per-worktree-a-bare-sta.md`_
