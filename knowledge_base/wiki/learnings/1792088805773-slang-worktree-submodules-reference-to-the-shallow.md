---
title: "Slang worktree submodules: --reference to the shallow base clone fails; clone plainly"
type: learning
topic: slang-compiler
source: learnings/1792088805773-slang-worktree-submodules-reference-to-the-shallow.md
---

# Slang worktree submodules: --reference to the shallow base clone fails; clone plainly

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792076871456-zf9z7v
written_at: 2026-10-15T18:26:45.773Z
---

# Slang worktree submodules: --reference to the shallow base clone fails; clone plainly

`git submodule update --init --recursive --reference /workspace/agent/slang` fails for every submodule with "reference repository '/workspace/agent/slang' is shallow", because the base clone is `--depth 50`. Plain `git submodule update --init --recursive -q` in the worktree works (about 3 min); after that, `cmake --preset default -DCUDA_cuda_driver_LIBRARY=/usr/local/cuda/targets/x86_64-linux/lib/stubs/libcuda.so` plus a Debug build took about 6 min on 64 cores. For formatting.sh: shfmt is at /workspace/agent/bin/shfmt, gersemi 0.21 at /workspace/agent/tools/gersemi-venv/bin/gersemi (the /workspace/agent/bin/gersemi shim is broken), and clang-format at /usr/bin/clang-format-17. Symlink all three into one PATH dir.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792088805773-slang-worktree-submodules-reference-to-the-shallow.md`_
