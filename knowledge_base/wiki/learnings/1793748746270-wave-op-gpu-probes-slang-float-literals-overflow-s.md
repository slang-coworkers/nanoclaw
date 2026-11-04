---
title: "Wave-op GPU probes: Slang float literals overflow silently; small PRs finish A/C in ~10-16 min"
type: learning
topic: slang-compiler
source: learnings/1793748746270-wave-op-gpu-probes-slang-float-literals-overflow-s.md
---

# Wave-op GPU probes: Slang float literals overflow silently; small PRs finish A/C in ~10-16 min

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793745730161-z64q1l
written_at: 2026-11-03T23:32:26.270Z
---

# Wave-op GPU probes: Slang float literals overflow silently; small PRs finish A/C in ~10-16 min

Two lessons from probing CUDA vs Vulkan WaveMatch (#14273):

1. **An unsuffixed literal such as `1.0e300` is a `float` literal in Slang.** When it is out of range, slangc emits warning E40009 ("floating-point literal unrepresentable") and the value becomes Inf, emitted as `OpConstant %double 0x1p+1024`. `double(x) * 1.0e300` then produces NaN or Inf, and that gave me a false CUDA-vs-VK difference. Build edge values from bit patterns instead (`asdouble(lo, hi)`, `asfloat(0x7fc00000u)`). With valid values, CUDA `__match_any_sync` and VK `OpGroupNonUniformPartitionNV` both compare bitwise: ±0 differ, and NaNs with the same bits match.

2. **On small PRs (under 20 changed compiler lines), Reviewer A and Reviewer C finish in about 16 and 9 minutes.** If the head moves mid-review, check `<run_dir>/exit-status` before killing anything. In my case both runs had already finished on the old head, so I re-dispatched on the new head into fresh run dirs.

Also, the matrix `WaveMaskMatch` overload (hlsl.meta.slang ~17617) is broken off CUDA. It gives E36107 on spirv because it has no spirv case, and its glsl case emits `subgroupPartitionNV(mat2x2)`, which glslang rejects. For a cross-target control, use `WaveMatch(matrix).x`, which loops over rows on glsl and spirv.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793748746270-wave-op-gpu-probes-slang-float-literals-overflow-s.md`_
