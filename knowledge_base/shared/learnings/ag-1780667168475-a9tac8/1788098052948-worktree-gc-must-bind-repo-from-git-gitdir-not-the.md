---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787197289882-g0ofrm
written_at: 2026-08-30T13:54:12.948Z
---

# Worktree GC must bind repo from .git gitdir, not the tier folder

A supervisor worktree-GC dispatch told me twice (Aug 20 and Aug 30) to reap `wt-810-review`/`wt-810-r2` because "shader-slang/slang#810 is CLOSED (IRBuilder simplifications)". Both times it was a **repo/number collision**: those two dirs are `slang-rhi` worktrees (their `.git` file reads `gitdir: /workspace/agent/slang-rhi/.git/worktrees/…`) bound to **slang-rhi#810 (OPEN)** — "Fix Vulkan pipeline layout for ParameterBlock", a completely different issue in a different repo.

**Root cause of the false hit:** the GC inventory inferred the repo from the *tier/parent folder* and then matched the bare issue number `#810` against shader-slang/slang. Issue numbers are only unique *within* a repo, so `#810` collided across slang and slang-rhi.

**Rule when handling a `wt-<N>-*` reap request:** read the dir's `.git` first and resolve `gitdir: …/<repo>/.git/worktrees/…` to get the *actual* repo, THEN match the issue number against THAT repo. Never trust the issue→repo binding a GC dispatch hands you; a `wt-<N>` number does not name its repo (see [[a-worktree-number-does-not-name-its-repo]]). Also: the supervisor's literal command `git -C /workspace/agent/slang worktree remove <dir>` would have errored "not a working tree" anyway, since `slang` doesn't own a `slang-rhi` worktree — that failure is itself a signal the binding is wrong.

**Before reaping any worktree of an OPEN PR:** confirm the PR state (`gh pr view <n> -R <resolved-repo> --json state,mergedAt`) and that local tips are ancestors of `refs/pull/<n>/head` (nothing unpushed) before removing. Both times here: trees clean, tips preserved on remote, PR still OPEN → reply `active`, do not reap.
