---
title: "Slang 64-bit buffer indexing works on direct subscript but IArray/IRWArray interface truncates to 32-bit (#11967)"
type: learning
topic: slang-compiler
source: learnings/1783415716330-slang-64-bit-buffer-indexing-works-on-direct-subsc.md
---

# Slang 64-bit buffer indexing works on direct subscript but IArray/IRWArray interface truncates to 32-bit (#11967)

For SPIR-V 64-bit indexing (`spvShader64BitIndexingEXT`, #11538/PR #11541 merged; E2E-test follow-up #11967):

**The functional index path bifurcates — verified empirically via `-dump-ir` on top-of-tree e39e3ce03:**
- **Direct concrete buffer subscript** `RWStructuredBuffer<int>[uint64_t idx]`: index preserved as `UInt64` all the way to `rwstructuredBufferGetElementPtr(..., %idx:UInt64)` → `OpAccessChain`. **No truncation, works.** The concrete `StructuredBuffer`/`RWStructuredBuffer`/`InputPatch`/`OutputPatch` subscripts already declare `__generic<TIndex : __BuiltinIntegerType> __subscript(TIndex index)` (hlsl.meta.slang:6011/6078/6102/7271), and `Ptr<>` uses `TInt : __BuiltinIntegerType` (core.meta.slang:1470). So `IPhysicalBuffer` is already covered at source level. `emitStructuredBufferGetElementPtr` (slang-emit-spirv.cpp:8863) passes the index operand verbatim to OpAccessChain with no width coercion — emit side is correct.
- **Interface-constrained generic path** `IArray<T>`/`IRWArray<T>.__subscript(int index)` (core.meta.slang:990 and :1036 — hard `int`): a `uint64_t` index is **silently truncated** — final IR shows `intCast(UInt64)→Int` before the access, plus front-end `warning E30081: implicit conversion not recommended`. **Broken.** This is the real bottleneck the issue names, not merely a missing test.

**Triage implication:** the fix is widen the IArray/IRWArray subscript *requirement* to generic `TIndex`, mirroring the buffer/Ptr subscripts. RISK: widening an interface requirement can force `Array`/`vector`/`matrix` conformances to re-satisfy — that conformance cascade is the "is it a blocker" question the maintainer surfaced; fallback is an additive `int`+generic overload. CoopVec/CoopMat subscripts also use `int` but index tiny register components → 64-bit not meaningful, out of scope.

**Test/container gotchas:** A true >2^32-element buffer *execution* test is impractical (>8 GB buffer) — the E2E guard is necessarily a **codegen** test (FileCheck `-target spirv-asm` for a 64-bit index → `OpTypeInt 64` operand on OpAccessChain), keep `-capability spvShader64BitIndexingEXT` in the directive. In this triage container `-target spirv-asm`/binary FAIL: downstream `spirv-dis`/`spirv-opt`/`slang-glslang` shared libs won't load ("failed to load dynamic library 'pthread'/'slang-glslang'") even with `LD_LIBRARY_PATH=build/Release/bin`. Use `-dump-ir` (pure Slang, no downstream tools) to inspect index width instead. CI has the full toolchain so spirv-asm tests run there. GPU present (L40S) but no NVIDIA Vulkan ICD installed locally, so COMPARE_COMPUTE can't run regardless.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783415716330-slang-64-bit-buffer-indexing-works-on-direct-subsc.md`_
