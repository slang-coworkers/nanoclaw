---
title: "Testing the buffer-load-arg (Site 4) heap-load specialization path"
type: learning
topic: ci-tooling
source: learnings/1780769206960-testing-the-buffer-load-arg-site-4-heap-load-speci.md
---

# Testing the buffer-load-arg (Site 4) heap-load specialization path

Companion to "spvDescriptorHeapEXT specialization fix: don't parameterize the heap global". That note covers the fix shape in `slang-ir-specialize-function-call.cpp`; this one covers how to write a regression test that actually exercises the *fourth* allowlist site — the `IRSPIRVLoadDescriptorFromHeap` arm in `FuncBufferLoadSpecializationCondition::doesParamWantSpecialization` (`slang-ir-specialize-buffer-load-arg.cpp`).

The texture repro (`Texture2D` param) does NOT reach this arm: `isTypePreferrableToDeferLoad` (`slang-ir-defer-buffer-load.cpp:59`) rejects opaque `Texture2D` at its early gate, so `doesParamWantSpecialization` returns false before the matcher. The texture path is driven by `ResourceParameterSpecializationCondition` instead. So Site 4 is only reachable by a *deferable struct/array* argument whose access chain roots at a heap load.

**Recipe to exercise Site 4 (verified on shader-slang/slang#11502 @ ffe92ec):**
- Define a struct that clears `isTypePreferrableToDeferLoad`. Two independent gates, either suffices: (a) natural size > `kBufferLoadElementSizeSpecializationThreshold` (= 128 bytes, `slang-ir-defer-buffer-load.cpp:29`); (b) `isCompositeTypeContainingArrays` returns true (any struct field that is an array type). A `struct BigStruct { float4 a[8]; float4 b[8]; float4 c[8]; }` = 384 bytes clears both. (Note: a struct of *scalar* fields under 128 B would NOT qualify — needs the array or the size.)
- Pass it through a heap descriptor: `DescriptorHandle<StructuredBuffer<BigStruct>> sb;` then `BigStruct v = pc.sb[0];` — the subscript lowers to `IRStructuredBufferLoad(IRSPIRVLoadDescriptorFromHeap(...))`, so the call-site arg's access-chain root is the heap load.
- Call a `[noinline]` callee taking the struct *by value*: `[noinline] float useStruct(BigStruct s)`. `[noinline]` is essential — `performForceInlining` would otherwise dissolve the callee before specialization.
- Assert with strict-ordered (non-DAG) FileCheck anchored at the cloned callee: `CHECK: %useStruct = OpFunction` then `CHECK: OpUntypedAccessChainKHR {{.*}} %slang_resourceHeap` — confirms the heap load was rebuilt *inside* the clone reading from the heap builtin global, not passed as a param.

**Review-process observation:** across 4 review rounds, the round-1 🔴 correctness bug (heap global parameterized as `uint` → invalid `OpUntypedAccessChainKHR` base) was found ONLY by the correctness reviewer (Reviewer A, REVIEW.md pipeline) via hand-tracing the SPIR-V emit path (`slang-emit-spirv.cpp:6975-7003 / 7165-7182`). Devin (Reviewer B) reported 0 bugs/flags; the clarity reviewer (C) explicitly called the fix "close to merge-ready". The bug was invisible to text-level review because the malformed SPIR-V still contains the expected opcode strings (a CHECK-DAG-only test passed on the broken code). Lesson: for descriptor-heap / specialization-clone changes, the correctness pass that traces the emit path is load-bearing and not substitutable by clarity or external-tool signals; and validate SPIR-V via `SLANG_RUN_SPIRV_VALIDATION=1` or a `CHECK` that binds the access-chain base to `%slang_resourceHeap`, never opcode-presence alone.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1780769206960-testing-the-buffer-load-arg-site-4-heap-load-speci.md`_
