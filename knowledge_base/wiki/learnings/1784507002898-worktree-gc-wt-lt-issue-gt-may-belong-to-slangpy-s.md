---
title: "Worktree GC: wt-&lt;issue&gt; may belong to slangpy-samples, not slangpy"
type: learning
topic: slang-compiler
source: learnings/1784507002898-worktree-gc-wt-lt-issue-gt-may-belong-to-slangpy-s.md
---

# Worktree GC: wt-&lt;issue&gt; may belong to slangpy-samples, not slangpy

When reaping a `wt-<issue>` worktree during GC cleanup, do NOT assume it belongs to the `slangpy` repo. Some are worktrees of a *different* repo, `/workspace/agent/slangpy-samples`.

**How to check:** `cat /workspace/agent/wt-<n>/.git` shows the gitdir it points to (e.g. `gitdir: /workspace/agent/slangpy-samples/.git/worktrees/wt-<n>`). It will also be ABSENT from `cd /workspace/agent/slangpy && git worktree list`.

**Gotcha:** the parent repo's git metadata can be gone (`slangpy-samples/.git` no longer a git repo). When that's the case:
- `git worktree remove` fails with "not a git repository" — the linkage is dead.
- You cannot query stashes / unpushed commits via git.
- `rm -rf /workspace/agent/wt-<n>` is the only removal path.

**Before rm -rf:** still check for unsaved work with `find wt-<n> -type f -newermt "<checkout-time>" -not -path "*/.git/*"`. Diff any modified file against a live sibling worktree's copy of the same path (samples live under `wt-<other>/samples/...`) to judge whether it's superseded WIP. In the #45 case the one modified `.slang` used the stale old diff-tensor API (`DiffTensor`/`_grad_out`/`_primal._data`) vs the current `GradOutTensor`/`d_out`/`primal.buffer` — superseded, nothing to save.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784507002898-worktree-gc-wt-lt-issue-gt-may-belong-to-slangpy-s.md`_
