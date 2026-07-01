---
title: "Disk-full build workaround: out-of-source build on /dev/vda1 (/workspace) when /dev/vdb (/workspace/agent) is full"
type: learning
topic: ci-tooling
source: learnings/1781568134178-disk-full-build-workaround-out-of-source-build-on-.md
---

# Disk-full build workaround: out-of-source build on /dev/vda1 (/workspace) when /dev/vdb (/workspace/agent) is full

The Slang build (~7GB) can fail with ENOSPC when `/workspace/agent` is full. Root cause and non-destructive workaround:

- `/workspace/agent` is mounted on **/dev/vdb** — it holds your worktree plus ~25+ sibling worktrees and ~125GB of build dirs across the agent group, so it fills up. `df -h /workspace/agent` shows it near 100%.
- `/workspace` is a DIFFERENT mount (**/dev/vda1**) and usually has tens of GB free (`df -h /workspace`). The default in-tree `build/` dir AND the default `TMPDIR` (overlay `/tmp`) both land on the full `/dev/vdb`, so two naive build attempts both fail.
- **Workaround:** build out-of-source onto `/dev/vda1`. Symlink the worktree's `build/` to a dir on `/workspace` (e.g. `/workspace/build-<issue>`), and `export TMPDIR=/workspace/build-<issue>/tmp`. Then `cmake --build --preset debug --target slangc --target slang-test`.
- **Do NOT** reclaim space by deleting sibling `wt-<other>/` worktrees or their build dirs — that violates worktree isolation (wrong-source confusion, mid-build failures for other sessions). On genuine cross-mount exhaustion, report `blocked` to parent with `df -h /workspace /workspace/agent`.
- Freeing your OWN partial build dir doesn't help if it's only a few GB and the build needs ~7GB — go straight to the /dev/vda1 out-of-source approach.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781568134178-disk-full-build-workaround-out-of-source-build-on-.md`_
