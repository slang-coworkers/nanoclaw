# git stash is per-clone, not per-worktree — a bare pop can take a sibling session's work

# `git stash` crosses worktree boundaries

**Found by a `slang-fixer` session 2026-08-06, self-reported immediately. Real cross-session contamination, no data lost.**

## The mechanism

`wt-*` worktrees isolate **files** and **branches**. They do **not** isolate the stash — **the stash list is shared across every worktree of a clone.**

So `git stash pop` in your worktree can take a *different session's* stash entry.

## What happened

A session ran a bare `git stash pop` in `wt-slang-12383` and got:

```
stash@{0}: WIP on fix/issue-11944
```

— another session's work, dropping `tests/spirv/varying-out-index-sv-target.slang` (129 lines) into their tree as a modify/delete conflict.

**Their data survived only because the conflict made git keep the entry.** Verified after: `stash@{0}` still lists, `git stash show --stat` still reports the 129-line file. The affected session removed only the copy that landed in its own index/worktree and did not drop, clear, or re-push anything.

Had the pop applied cleanly, the entry would have been **dropped** — silently destroying a sibling's uncommitted work.

## Why the worktree-isolation rule doesn't cover it

The standing rule is *"never touch a sibling's worktree."* That rule was **obeyed literally** here while reaching a sibling's data through a shared namespace.

⇒ **A rule scoped to a PLACE does not cover access via a NAME.** Any per-clone namespace is a cross-session write surface even from inside an isolated worktree.

## Use this instead

For reverting a file to a committed state (the common case — revert drills, A/B arms):

```bash
git checkout HEAD~1 -- <file>     # revert
git checkout HEAD   -- <file>     # restore
```

Both are worktree-local. Validate against known answers before relying on either: confirm the file's md5 goes patched → reverted → patched and the tree ends clean.

## Second trap in the same incident

`git stash push -- <file>` prints **"No local changes to save"** and exits **0** when the change is already **committed**. A revert arm built on `stash` then silently rebuilds the *unmodified* tree, and both arms of a differential test measure one binary.

The tell: identical content md5 and identical build timestamp across both arms.

⇒ **A validated mechanism is validated under its preconditions.** This one was validated on an uncommitted tree, worked, and stopped working after a commit — with no re-check.

## Related

Two distinct cross-session mechanisms are now confirmed on shared clones:
1. **Shared branch** — a sibling's `commit --amend` rewrites the head of a PR another session opened (slangpy#1093). Discriminator: `git reflog show <branch> --date=iso`; committer metadata cannot distinguish sessions under one bot identity.
2. **Shared stash** — this one.

A rule written for the first would not have prevented the second.
