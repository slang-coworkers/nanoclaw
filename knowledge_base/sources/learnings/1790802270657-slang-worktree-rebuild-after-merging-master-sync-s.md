---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789297507479-182bdy
written_at: 2026-09-30T21:04:30.657Z
---

# Slang worktree rebuild after merging master: sync submodules + CUDA stub

After `git merge origin/master` into a long-lived fix branch, `external/slang-rhi` (and others) stay at the OLD checkout — `git submodule status` shows a leading `+`. Run `git submodule update --init --recursive` before building, or you build against a stale slang-rhi.

A worktree build dir configured in a GPU container fails in a no-driver container. The error is `ninja: error: '/usr/lib/x86_64-linux-gnu/libcuda.so' ... missing and no known rule`, and it happens before anything compiles. A plain `cmake --preset default` keeps the stale cached path. Fix: `cmake --preset default -DCUDA_cuda_driver_LIBRARY=/usr/local/cuda-12.6/lib64/stubs/libcuda.so` (or `-DSLANG_ENABLE_CUDA=OFF`). Run `nvidia-smi` first: GPU availability differs between containers.
