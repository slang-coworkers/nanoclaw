---
title: "git stash pop is a stack op on a SHARED stack — never pop bare in a multi-session checkout"
type: learning
topic: agent-ops
source: learnings/1785830243413-git-stash-pop-is-a-stack-op-on-a-shared-stack-neve.md
---

# git stash pop is a stack op on a SHARED stack — never pop bare in a multi-session checkout

## What happened

In a repo where several agent sessions work in sibling git worktrees, I stashed one file to run an A/B, rebuilt, then ran a bare `git stash pop`. It popped **another session's** stash — an unrelated `fix/issue-12185` entry — merging conflicts into `slang-diagnostics.lua`, `slang-emit-spirv.cpp`, and two test files my branch never touched.

The stash stack is **per-repository, not per-worktree and not per-session**. Every worktree sharing a `.git` shares one stash list. `pop` takes `stash@{0}` — whatever landed on top most recently, which may be someone else's push that happened between your push and your pop.

## The rule

```bash
git stash push -m "12150 occurrence fix"  -- path/to/file   # always label
git stash list | head -5                                    # find YOUR label
git stash pop 'stash@{2}'                                   # pop by verified index
```

Never bare `git stash pop` / `git stash apply` in a shared checkout. Label on push, verify the label, pop by explicit index. Prefer `apply` + explicit `drop` over `pop` when the stash is expensive to recreate — `pop` drops on success, so a botched merge leaves you reconstructing.

Better still, for a short-lived A/B: **commit** instead of stashing (`wip:` commit, then `git revert`/`reset` back), which is per-branch and cannot collide.

## Recovering from a wrong pop

Do not `reset --hard` — that discards your own work along with the pollution. Establish ownership **per conflicted path**:

```bash
git log --oneline master..HEAD -- <conflicted-path>   # empty => not yours => pollution
```

Files your branch never touched are pollution: `git checkout HEAD -- <path>` for modify/modify, `git rm --cached` + `rm` for the modify/delete cases. Then confirm your own change is intact by a distinctive marker (`grep -c <your-symbol>`) before rebuilding — don't assume the pop left it alone.

The wrongly-popped stash is *kept* on failure ("The stash entry is kept in case you need it again"), so the other session's work is not lost by your cleanup — leave it on the stack.

## The family this belongs to

Same shape as `git checkout -- <file>` destroying uncommitted work: **a convenient default that silently operates on the wrong target.** Both are "do the obvious thing" commands whose notion of the obvious target (HEAD; top-of-stack) differs from yours (undo just my traces; restore just my stash). Where a command has an implicit target and the cost of being wrong is other people's work, name the target explicitly.

Related: [[git checkout -- <file> destroys uncommitted work]].

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785830243413-git-stash-pop-is-a-stack-op-on-a-shared-stack-neve.md`_
