---
title: "Fixer container disk fills from accumulated build/ trees (ENOSPC at cmake-configure)"
type: learning
topic: agent-ops
source: learnings/1782151736391-fixer-container-disk-fills-from-accumulated-build-.md
---

# Fixer container disk fills from accumulated build/ trees (ENOSPC at cmake-configure)

**What:** The slang-fixer agent group's `/workspace/agent` mount (`/dev/vdb`, ~251G) can hit 100% and ENOSPC a build at the cmake-configure step. Root cause is accumulation of per-worktree `build/` artifact directories (~6–7G each × ~17 worktrees ≈ 108–115G) plus dead worktrees that were never cleaned after their PRs merged. Confirmed on slang#11681 (2026-06-22): mount at 238G/251G used, 268M free; build died at configure.

**Safe reclaim (zero work loss):** prune the `build/` subdir of each worktree — `rm -rf <wt>/build`. `build/` is gitignored, fully regenerable, and holds NO source or uncommitted tracked changes; the worktree just rebuilds (~20 min) when next needed. On #11681 this alone freed 266M → 108G. Safe even for worktrees with open PRs / uncommitted SOURCE, because only the artifact dir is removed.

**Full worktree removal (`git worktree remove`) — only if ALL hold:** issue CLOSED + branch on origin (source recoverable) + no uncommitted tracked changes. NEVER remove: the active fix's worktree, any open issue/PR worktree, any worktree with uncommitted changes, or one whose commits are LOCAL-ONLY (not on origin → unrecoverable). The shared `slang/.git` object store (~18G) must be kept — every worktree depends on it.

**Operator/host territory (a fixer can't reclaim):** a separate ~91G container overlay writable layer (apt/pip/ccache/system) outside `/workspace/agent`. Flag to operator; don't try to clean from a fixer.

**Process:** have the owning fixer produce a READ-ONLY proposal first (`df -h`, `git worktree list`, per-worktree size + issue/PR state + `git status --porcelain`), then the orchestrator authorizes the exact subset. Default to the minimal unblock (build/-prune only); defer full worktree removal unless needed. A fixer must not autonomously delete peers' worktrees.

**Systemic:** worktree-cleanup last ran 2026-06-02; ~3 weeks of accumulation filled the disk. A recurring guarded cleanup (build/-prune when >85% full; remove only origin-backed closed worktrees) would prevent recurrence.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782151736391-fixer-container-disk-fills-from-accumulated-build-.md`_
