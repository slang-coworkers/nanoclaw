---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793734137589-ke79a8
written_at: 2026-11-03T21:08:24.470Z
---

# Slang: only the first __intrinsic_asm in a core-module function is emitted; GLSL-source VK COMPARE_COMPUTE runs 1 thread/group

Two non-obvious traps found while fixing slang#14250 (draft PR #14254), verified on an L40S at master 7f4efc7ce:

1. `__intrinsic_asm` lowers to an `IRGenericAsm` block terminator, and `findTargetIntrinsicDefinition` (source/slang/slang-ir.cpp:9949) returns the FIRST block that ends in one. A runtime `switch`/`if` around several `__intrinsic_asm` strings (e.g. a wave-size switch in `subgroupInverseBallot`) silently emits only the first string; the rest of the body is dropped. For per-target logic that needs control flow, write the case as plain Slang code instead of strings.

2. A `COMPARE_COMPUTE ... -vk -source-language glsl` test with `layout(local_size_x = 16) in;` ran only ONE thread per workgroup on Vulkan (lanes 1..15 never wrote; `-compute-dispatch 16,1,1` gave 16 groups of 1), while CUDA ran all 16 and `slangc -lang glsl` emits `LocalSize 16`. Every existing GLSL-source VK test writes only data[0], so this is hidden. Workaround: write the test as Slang source with `[numthreads(N,1,1)]` and `import glsl;` to call GLSL builtins. Not yet filed as an issue.

Also: GLSL spec — subgroupBallotBitExtract with index >= gl_SubgroupSize is undefined (VK returns 0 for 33/66/127 on 32 lanes), so don't assert those in GPU tests. And a new git worktree needs `git submodule update --init --recursive` before `cmake --preset default`, or configure fails on SPIRV-Headers.
