---
title: "Slang #11496 SPIR-V SIGSEGV — static getFormatInst() triage hypothesis was wrong; real cause is orphan IRParam"
type: learning
topic: slang-compiler
source: learnings/1780768927407-slang-11496-spir-v-sigsegv-static-getformatinst-tr.md
---

# Slang #11496 SPIR-V SIGSEGV — static getFormatInst() triage hypothesis was wrong; real cause is orphan IRParam

## Finding (shader-slang/slang#11496, HEAD 5230a81; corrected by debug-build run in the fix chain)

A `DescriptorHandle<Texture2D>` passed into a `[noinline]` callee alongside a buffer-pointer array arg, then sampled, SIGSEGVs during SPIR-V emit under `-capability spvDescriptorHeapEXT`.

**A plausible static-read triage hypothesis was WRONG.** From reading source alone, the crash looked like an unguarded `IRResourceTypeBase::getFormatInst()` (slang-ir.h:1377) reading the *optional* operand-8 (format) of a no-format `IRTextureType` at the asm-operand image-type rebuild site `slang-emit-spirv.cpp:10920` (the `kIROp_SPIRVAsmOperandImageType/SampledImageType` arm). `IRResourceType::hasFormat()` checks `getOperandCount() >= 9`, the peer reader `getSpvImageFormat` (:2896-2899) guards with it, and `:10920` did not — so "missing format operand, add a `hasFormat()` guard" looked like the fix.

**It was not.** A debug build with the proposed `hasFormat()` guard added *still SIGSEGV'd*. The real immediate cause: `as<IRTextureTypeBase>(operand->getValue()->getDataType())` returns **null** because the operand value is a stranded/orphan `IRParam` — no parent function, null `getFullType()`. The crash is the null `as<>` result being dereferenced, not a short operand list.

**Producer of the orphan IRParam:** `specializeFuncsForBufferLoadArgs` + the post-clone `simplifyFunc` (`slang-ir-specialize-function-call.cpp:1140`, `IRSimplificationOptions::getFast`) / `replaceImageElementType` (`slang-ir-resolve-texture-format.cpp:8-38`) path, triggered when a `[noinline]` callee receives both a `CastDescriptorHandleToResource`/`SPIRVLoadDescriptorFromHeap` texture arg and a buffer-load array arg. The float3/float4-only narrowing matches `replaceImageElementType`'s vector-element rebuild; Sample-vs-Load matches the combined-texture-sampler lowering only firing for Sample. Root cause tracked in #11498; partial fix #11499 converts the crash into a clean `error[E99997]` (does not unblock the user's shader).

## Methodology takeaway (the reusable lesson)

For SPIR-V-emit SIGSEGVs, a static file-read root-cause hypothesis is a *hypothesis*, not a verdict — it MUST be confirmed by a debug-build single-step (or at least by checking the proposed fix actually eliminates the crash) before being treated as the cause. A defensive null/bounds guard that "looks like the safe pattern" can be directionally useful (this one is part of the partial fix) yet address a symptom layer above the real bug. When the stack shows `getOperand(N)` / `as<T>(x)`, distinguish "operand list too short" from "x itself is null/orphan" — they present similarly (null deref deep in an accessor) but have completely different root causes. An orphan `IRInst` with null `getFullType()` reaching emit points at a clone/specialize pass that left an inst unparented, not at the emit code.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780768927407-slang-11496-spir-v-sigsegv-static-getformatinst-tr.md`_
