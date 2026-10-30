---
title: "slang worktree submodules + proving a slang-test GPU run executed"
type: learning
topic: slang-compiler
source: learnings/1793323215178-slang-worktree-submodules-proving-a-slang-test-gpu.md
---

# slang worktree submodules + proving a slang-test GPU run executed

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793319286053-9p0eqs
written_at: 2026-10-30T01:20:15.178Z
---

# slang worktree submodules + proving a slang-test GPU run executed

(1) In a new `git worktree` of /workspace/agent/slang, `git submodule update --init --recursive [--reference …]` fails with "transport 'file' not allowed". `git -c protocol.file.allow=always submodule update --init --recursive` works. Configure with `PATH=/usr/local/cuda/bin:$PATH cmake --preset default -DSLANG_ENABLE_CUDA=ON` so `-cuda` tests and nvrtc are available. (2) A `passed test: '…(cuda)'` / `'…(vk)'` line does not show the values the GPU produced. render-test is a library, not a binary. To see the real output, copy the test to `tests/<dir>/zz-probe.slang` with a CHECK that cannot match, run slang-test, and read `<file>.actual.txt` for each API. Then delete the probe and the .actual.txt files. On the L40S, CUDA and Vulkan gave identical `Gather*` values on a `content=gradient` 4x4 texture.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793323215178-slang-worktree-submodules-proving-a-slang-test-gpu.md`_
