---
type: project
name: project_13603_spirv_glsl_bab_float3_stride_index
description: "slang#13603 (bot-filed 10-13 15:18Z by slang-fixer while applying #11803 R2 nits): on SPIR-V/GLSL, plain ByteAddressBuffer Load<float3>/Store<float3> at a non-zero multiple of 12 index the stride-16 v3float alias by offset/12 -> wrong bytes, silent. Pre-existing on master, separate from #11803, sibling of closed #9931. Owned by the #11545 chain; NO fixer dispatched; gate i13603-maintainer-gate-af2c (STALE 10-18T15:18Z)."
metadata:
  node_type: memory
  type: project
---

# slang#13603: SPIR-V/GLSL plain BAB `Load<float3>(12)` reads bytes 16–27

**Origin.** slang-fixer session `sess-1781189172097-tx3d2b` (thread `gh-issue-shader-slang/slang-11545`) found it while
applying the #11803 R2 nits (the `Load<float3>` doc contradiction, R2-a). It is listed in the fixer's `[Fix Report]` to
the dashboard Main (row 500406, 15:20Z), and the dashboard Main's 5-bullet (row 500409, 15:20:47Z) already told the
operator about it as "separate from this PR". See [[project_11545_bytebuffer_alignment_chunker_stack]].

**Content.** `emitSimpleLoad`/`emitSimpleStore` (`slang-ir-byte-address-legalize.cpp`) with
`translateToStructuredBufferOps` turn the byte offset into an index by dividing by the natural stride (12 for `float3`),
but the aliased structured buffer is std430 with `ArrayStride 16`. With no alignment argument, `isWideAccessAligned`
accepts any literal multiple of 12. Main reproduced it on the local Release build: SPIR-V `%uint_1`/`%uint_3`,
GLSL `buffer_0._data[3U] = buffer_0._data[uint(1U)]`. HLSL/CUDA/C++ index by byte and are fine. Related: #9931 (closed).

**Disposition: owned, nothing dispatched.** The `issue_opened` webhook was the filing's self-echo. The owner ladder hit
on rung 7 (fixer row 228's learning + Fix Report) and rung 8 (dashboard Main already reported it). Neither armed a resume
trigger, so the webhook session armed `i13603-maintainer-gate-af2c` (`gates/i13603-maintainer-gate.sh`, wraps
`i13433-decision-gate.sh`; controls passed: quiet, STALE, CLOSED #12457, HUMAN_REPLY #13433 w/ early SINCE, bot-only #13530).

**Resume path.** A non-bot comment routes on `gh-issue-shader-slang/slang-13603`: fix go-ahead → slang-fixer (must not
land inside #11803 unless the maintainer says so), question → slang-triager. STALE → ask the operator whether to dispatch.
