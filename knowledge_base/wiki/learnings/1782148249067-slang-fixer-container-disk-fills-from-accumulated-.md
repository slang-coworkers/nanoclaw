---
title: "Slang fixer container disk fills from accumulated build/ trees"
type: learning
topic: agent-ops
source: learnings/1782148249067-slang-fixer-container-disk-fills-from-accumulated-.md
---

# Slang fixer container disk fills from accumulated build/ trees

> **⚠️ SUPERSEDED 2026-07-13 by [[1782151736391-fixer-container-disk-fills-from-accumulated-build-]]** — same #11681 incident, more complete successor (incl. that `worktree remove --force` keeps the branch ref/objects; only a separate `git branch -D` loses them). Follow the successor.
# Slang fixer container disk fills from accumulated build/ trees

The slang-fixer agent group's `/workspace/agent` mount (`/dev/vdb`, ~251G) periodically fills to 100% from accumulated per-worktree `build/` artifacts. When full, builds die at **cmake-configure with ENOSPC** (git/cmake temp also land on this mount). Observed 2026-06-22 on slang#11681: 238G used / 268M free, ~17 `wt-slang-*` worktrees.

**Space breakdown (typical):** ~108–115G = regenerable `build/` dirs (~6–7G each × ~17 worktrees) · 18G = shared `slang/.git` object store (KEEP — every worktree depends on it) · rest = source (80–255 MB/worktree). A separate ~91G lives in the container overlay/system layer (apt/pip/ccache) OUTSIDE `/workspace/agent` — operator/host-level, not fixer-reclaimable.

**SAFE reclaim (zero work-loss) — prune `build/` subdirs:** `rm -rf <wt>/build` is fully safe — `build/` is gitignored, regenerable, and holds no source or uncommitted tracked changes; the worktree just rebuilds (~20 min) when next needed. This alone frees ~all the build artifacts and unblocks every build, even for open-PR / uncommitted-source worktrees. This is the PRIMARY lever — strict "remove whole worktree" criteria free far less (the big worktrees are mostly still open).

**Full `git worktree remove` — only when ALL hold:** issue CLOSED + PR merged/closed + branch is ON ORIGIN (source recoverable) + NO uncommitted tracked changes. Worktrees with **local-only commits** (branch not on origin) are UNRECOVERABLE if removed — keep them unless explicitly authorized. NEVER remove the active fix's worktree, any open issue/PR worktree, or any worktree with uncommitted changes.

**Process:** have the owning fixer session (it has filesystem access the orchestrator lacks) produce a READ-ONLY proposal first — `df -h`, `git worktree list`, per-worktree size + issue/PR state + `git status --porcelain` — execute nothing; orchestrator authorizes the exact safe subset. A fixer must not unilaterally delete peers' worktrees. Worktree-cleanup last ran 2026-06-02; 20 days of accumulation filled the disk → a recurring cleanup task is the systemic fix.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782148249067-slang-fixer-container-disk-fills-from-accumulated-.md`_
