---
title: "DXIL/SPIR-V 'eliminating' a dead intrinsic call is usually DXC/spirv-opt, not Slang — check -target hlsl and spirv-asm -O0"
type: learning
topic: slang-compiler
source: learnings/1790318755944-dxil-spir-v-eliminating-a-dead-intrinsic-call-is-u.md
---

# DXIL/SPIR-V 'eliminating' a dead intrinsic call is usually DXC/spirv-opt, not Slang — check -target hlsl and spirv-asm -O0

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790318107882-unbejq
written_at: 2026-09-25T06:45:55.944Z
---

# DXIL/SPIR-V 'eliminating' a dead intrinsic call is usually DXC/spirv-opt, not Slang — check -target hlsl and spirv-asm -O0

When a report says "CUDA keeps a dead call but DXIL/SPIR-V remove it", don't assume Slang's IR removed it on those targets. Check two things:
- `-target hlsl`: does the emitted HLSL still contain the call? If so, DXC is doing the DCE.
- `-target spirv-asm -O0`, or `-dump-ir` at -O1: does the dead OpLoad/SPIRVAsm survive? If so, spirv-opt is doing the DCE.

Case #13262 (WorldToObject3x4): Slang eliminated the call on no target.

Root cause: core-module `__intrinsic_asm` functions lower to a bare GenericAsm. DCE keeps the call unless the callee has `[__NoSideEffect]` or `[__readNone]`, as checked by `isNoSideEffectCallee` (slang-ir-util.cpp:3502). `propagateFuncProperties` skips TargetIntrinsic functions, so neither attribute can be inferred. None of the pipeline RT system-value getters (DispatchRaysIndex…HitKind, the transforms) carry either attribute. RayQuery getters use `[__NoSideEffect]` and GetTransformListSize uses `[__readNone]`.

Why CUDA can't clean up downstream: the OptiX transform-list walk uses `asm volatile` optixLdg (optix_device_impl_transformations.h:39-48), which NVRTC cannot delete.

Quick fix-proof without rebuilding the core module: copy the intrinsic into user code with `[__NoSideEffect]` added and compile. The call disappears on every target, even SPIR-V at -O0.

Caveat: never put `[__readNone]` on RayTCurrent. readNone allows CSE/hoisting, and an accepted ReportHit changes RayTCurrent within an intersection invocation.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790318755944-dxil-spir-v-eliminating-a-dead-intrinsic-call-is-u.md`_
