---
title: "spvDescriptorHeapEXT specialization fix: don't parameterize the heap global"
type: learning
topic: ci-tooling
source: learnings/1780734760813-spvdescriptorheapext-specialization-fix-don-t-para.md
---

# spvDescriptorHeapEXT specialization fix: don't parameterize the heap global

When routing `kIROp_SPIRVLoadDescriptorFromHeap` through `FunctionParameterSpecializationContext`, the `(heap, index)` operand pair is **not** symmetric the way the `IRCastDescriptorHandleToResource` operand is. The `heap` operand is the `kIROp_SPIRVResourceHeap`/`kIROp_SPIRVSamplerHeap` builtin global — at the IR level it has `uint` type, but the emitter materializes it as `SpvOpUntypedVariableKHR` *pointer* in `UniformConstant` storage (`slang-emit-spirv.cpp:6975-7003`), and `emitDescriptorHeapLoad` uses it directly as the base of `SpvOpUntypedAccessChainKHR` (`slang-emit-spirv.cpp:7165-7182`).

If you `createParam(oldHeap->getFullType())` and pass it through `newArgs`/`newParams` like the cast variant does, the cloned callee gets a `uint` `OpFunctionParameter` and the rebuilt access-chain base becomes a `uint` scalar — invalid SPIR-V. The original SIGSEGV (#11498) goes away (orphan-IRParam path is structurally removed) but the emitted code is silently malformed.

**Correct shape:** parameterize *only* the index. In `getCallInfoForArg`, push the heap into `ioInfo.key.vals` (so it discriminates clones) but NOT `newArgs`. In `getSpecializedValueForArg`, create only `newIndex`; reuse `loadFromHeap->getOperand(0)` (the original heap inst) as operand 0 of the rebuilt `SPIRVLoadDescriptorFromHeap` inside the cloned callee body. The heap is hoistable+module-scoped (`slang-ir-insts.lua:985`), so it's safely accessible from the clone.

**Test gotcha:** `//TEST:SIMPLE -target spirv-asm` does *not* run validation — `shouldRunSPIRVValidation` (`slang-emit.cpp:3005`) only fires when `SLANG_RUN_SPIRV_VALIDATION=1`. So a CHECK-DAG-only test on text presence (e.g. `OpCapability DescriptorHeapEXT`, `OpImageSampleImplicitLod`) will pass even when the access-chain base is a uint param. Either set the env var, add a `CHECK-NOT` that an `OpFunctionParameter` feeds `OpUntypedAccessChainKHR`, or pair with `COMPARE_COMPUTE` like `tests/spirv/descriptor-heap-byte-address-buffer.slang` does.

**Idiomatic accessors:** `IRSPIRVLoadDescriptorFromHeap` declares operands `{ "heap" }, { "index" }` in `slang-ir-insts.lua` and the rest of the codebase reads via `getHeap()`/`getIndex()` (`slang-ir-byte-address-legalize.cpp:1068-1069`, `slang-ir-spirv-legalize.cpp:1361-1362`); `IRBuilder::emitLoadDescriptorFromHeap(type, heap, index)` (`slang-ir.cpp:3167`) wraps the rebuild — prefer those over positional `getOperand(0)/(1)` + raw `emitIntrinsicInst(..., kIROp_SPIRVLoadDescriptorFromHeap, 2, ...)`.

Source: shader-slang/slang#11502 review (Reviewer A correctness + Reviewer C clarity, 2026-06-06). #11498 is the SIGSEGV this fix targets; #11483 is a *separate* sibling rooted in `emitDescriptorHeapLoad` (emit pass) and is not subsumed.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1780734760813-spvdescriptorheapext-specialization-fix-don-t-para.md`_
