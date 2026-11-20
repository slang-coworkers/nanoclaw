---
type: chain-record
description: Vulkan validation errors for atomics on RWBuffer via-glsl — render-test stale format name, not a compiler defect; fixed in draft PR #14598, review-complete, ready-flip pending
---

# slang#14592: Vulkan validation errors for atomics on an RWBuffer with -emit-spirv-via-glsl

**Issue:** https://github.com/shader-slang/slang/issues/14592 (filed 11-18 by jkwak-work, self-assigned; P2 bug).
`InterlockedAdd` on `RWBuffer<uint>` under `-vk -emit-spirv-via-glsl` → 5 VUID validation errors; atomics
silently no-op (all-zero readback). Filed in reference to PR #14561's branch.

**Triage (exonerated the emitter):** emitted GLSL is correct (`layout(r32ui) uniform uimageBuffer` + `imageAtomicAdd`;
the test's "GLSL output doesn't replace InterlockedAdd" comment was stale). Root cause: `//TEST_INPUT:ubuffer(format=R_UInt32,...)`
is a pre-slang-rhi format name; render-test's `_getFormatFromName` silently mapped it to `Format::Undefined` (BufferVal path
lacked the Undefined check the texture path has) → slang-rhi built a `VK_FORMAT_UNDEFINED` texel-buffer view.

**Chain:** webhook 15:06Z → triager (sess-1795014447704-zu1qhj) → fixer (sess-1795015900212-g79t42) → **draft PR #14598**
(branch fix/issue-14592, opened ~16:24Z).

**Fix:** test data + render-test hardening, emitters untouched. `R_UInt32`→`R32Uint` and vk + via-glsl TEST lines re-enabled in
atomics-buffer.slang; unknown format= names now abort at parse with a value-named error ("Unknown format 'X' at line N") in
shader-input-layout.cpp, call-site checks deduplicated; new GPU-free emission pin atomics-buffer-emission.slang (OpImageTexelPointer +
OpAtomicIAdd, direct + via-GLSL); dormant stale name in texture-simple.slang fixed (R_Float32→R32Float).

**State (11-18 17:13Z Fix Report):** review complete — APPROVE_WITH_NITS applied (centralized rejection diagnostic, GPU-free emission
pin, dormant stale-name fix; declined parse-fail unit test with justification + declined TEST-line history note per directory
convention). CODE_REVIEW + OUTPUT_REVIEW codex gates approve. Head `5f6bbc858` (verified). Repro PASS 2/2 on L40S, atomics sweep 21/21,
texture-format consumers 18/18. **Ready-flip pending** — awaiting human review; issue closes when PR merges. PR #14561 rebase-collision
flagged in Risk. Follow-up NOT taken: slang-rhi-side Undefined texel-buffer-view guard (approach C, cross-repo — needs care to keep
SSBO paths where Undefined is legal).
