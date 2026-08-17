---
title: "spvDescriptorHeapEXT path — fix function-call specialization allowlists, not the downstream pass"
type: learning
topic: ci-tooling
source: learnings/1780733286644-spvdescriptorheapext-path-fix-function-call-specia.md
---

# spvDescriptorHeapEXT path — fix function-call specialization allowlists, not the downstream pass

# spvDescriptorHeapEXT path — fix function-call specialization allowlists, not the downstream pass

When a `[noinline]` callee taking a resource-typed param (e.g. `Texture2D`) is called with `DescriptorHandle<T>` under `-capability spvDescriptorHeapEXT`, the call-site arg lowers to `kIROp_SPIRVLoadDescriptorFromHeap` (`hlsl.meta.slang:27133-27135`), NOT `IRCastDescriptorHandleToResource`. The function-call specialization machinery had four sites that accepted the cast variant but not the heap-EXT variant:

- `source/slang/slang-ir-specialize-function-call.cpp:46` — `isParamSuitableForSpecialization` (suitability gate).
- `source/slang/slang-ir-specialize-function-call.cpp:653` — `getCallInfoForArg` cast branch.
- `source/slang/slang-ir-specialize-function-call.cpp:952` — `getSpecializedValueForArg` cast branch.
- `source/slang/slang-ir-specialize-buffer-load-arg.cpp:120` — `FuncBufferLoadSpecializationCondition` root-arg matcher.

Under `-target spirv` direct-emit, `ResourceParameterSpecializationCondition::doesParamWantSpecialization` flags every `IRTextureType` param as wanting specialization (`isIllegalSPIRVParameterType` returns true for all texture types). The base `isParamSuitableForSpecialization` is then the chokepoint that decides if the call-site arg form is supported — if it returns false, the entire call's resource specialization is short-circuited (`slang-ir-specialize-function-call.cpp:262`). With the heap-EXT variant rejected at the gate, the callee survived `[noinline]` into the buffer-load-spec clone path; some later type-rewrite pass (`lowerBufferElementTypeToStorageType` is the prime suspect — pass 077 in dump-000 — renumbers witness IDs) desynced the texture asm-operand back-reference, producing a SIGSEGV at `slang-emit-spirv.cpp:10907` where `as<IRTextureTypeBase>(operand->getValue()->getDataType())->getElementType()` deref'd null (#11498, fix in PR #11502).

**Fix shape (Approach A — what worked):** Add the heap-EXT opcode at all four sites, mirror-symmetric with the cast variant. The structural payoff is in Site 3 (`getSpecializedValueForArg`): emit a fresh `SPIRVLoadDescriptorFromHeap(newHeap_param, newIndex_param)` *inside* the cloned callee, so the texture is materialized as an in-block instruction rather than a passed-in `IRParam` — which removes the orphan-IRParam precondition that the downstream pass was tripping on. **The downstream type-rewrite bug isn't fixed; it's just made unreachable for the descriptor-heap-EXT case.** If the same crash signature appears on a different code path, the orphaning event in `lowerBufferElementTypeToStorageType` is the next thing to audit (Approach B).

**Specialization-key gotcha:** The cast variant keys on `oldBase->getFullType()` (the handle type, which encodes T). For the heap-EXT variant, operand types `(heap, index)` are uniform across all heap loads — only `oldArg->getFullType()` (the result resource type) carries `T`. Key on `oldArg->getFullType()`, not operand types, or specializations will cache-collide.

**Scope check before extending:** Only the heap-EXT opcode `kIROp_SPIRVLoadDescriptorFromHeap` is in scope for this bug. The non-EXT siblings `kIROp_LoadResourceDescriptorFromHeap` / `kIROp_LoadSamplerDescriptorFromHeap` (`slang-ir-insts.lua:978,980`) are HLSL-backend-only per `hlsl.meta.slang:27125-27135` and not in the SPIR-V crash surface. Don't add them speculatively.

**Anti-misdirection:** DeepWiki's general-case answer says "DescriptorHandle<T> is represented as IRCastDescriptorHandleToResource" — that is correct for the non-heap-EXT path only. Always confirm the call-site arg form via `slangc -dump-ir-after specializeFuncsForBufferLoadArgs ...` or `extras/split-ir-dump.py` rather than trusting general guidance. The `dump-000/057-AFTER-...` pass-output for this repro showed `let %201 : TextureType(...) = SPIRVLoadDescriptorFromHeap(%13, %200)` — definitive evidence.

Verified at HEAD `5230a81f2` of shader-slang/slang.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780733286644-spvdescriptorheapext-path-fix-function-call-specia.md`_
