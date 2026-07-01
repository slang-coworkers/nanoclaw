---
title: "Disk-full on /workspace/agent: prune worktree build/ dirs, not whole worktrees"
type: learning
topic: ci-tooling
source: learnings/1782151532732-disk-full-on-workspace-agent-prune-worktree-build-.md
---

# Disk-full on /workspace/agent: prune worktree build/ dirs, not whole worktrees

**Symptom:** builds ENOSPC at `git submodule update` / `cmake --preset` (cannot create build/CMakeFiles or external/*/registry) even when a `df -h` line shows GBs free elsewhere. Root cause is `/workspace/agent` itself being full.

**Filesystem facts (2026-06-22):** `/workspace/agent` is its OWN mount `/dev/vdb` (251G). It is NOT `/dev/vda1` — that's `/app/src`, a separate 124G mount. An earlier diagnosis wrongly equated `/workspace` with vda1's free space; **always confirm with `df -h /workspace/agent`**, not the generic `df -h` mount labels. `/tmp` is on the same full filesystem, so temp writes from git/cmake also fail when it's full.

**What fills it:** per-issue worktree `build/` dirs — a slang Debug build is ~6–7.6 GB EACH. ~17 of them = ~115 GB. The base `slang/.git` shared object store is ~18 GB (KEEP — all worktrees depend on it). Source per worktree is tiny (80–255 MB).

**The right reclaim = prune `build/` subdirs, NOT remove worktrees.** `rm -rf <wt>/build` is zero-work-loss: build/ is gitignored, fully regenerable, holds no source or uncommitted tracked changes; the worktree just rebuilds (~20 min) next time. This is safe even for worktrees with OPEN draft PRs and uncommitted source. Pruning 16 build dirs took /workspace/agent from 266M free → 108G free in one pass.

**Why NOT the "closed/merged issue → delete worktree" criterion alone:** it frees almost nothing here, because the big build-bearing worktrees are nearly all OPEN draft PRs (→ keep). The few closed-issue worktrees are the small (no-build) ones. So worktree removal ≈ ~10 GB; build/ pruning ≈ ~115 GB. Build-pruning is the lever.

**Guards when pruning:** hardcode the explicit dir list; `case` to assert each path is `/workspace/agent/wt-*` and ABORT if any resolves to the active worktree; skip if `build` is a symlink; `du` before rm for the audit. Never `git worktree remove`, never touch source/.git/peers.

**Note:** ~91 GB of the 238 GB used was OUTSIDE /workspace/agent (container overlay writable layer) — operator/host territory, not fixer-reclaimable. Build-pruning the 115 GB is enough to unblock regardless.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782151532732-disk-full-on-workspace-agent-prune-worktree-build-.md`_
