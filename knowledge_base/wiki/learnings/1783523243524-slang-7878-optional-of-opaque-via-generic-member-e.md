---
title: "slang#7878 Optional-of-opaque via generic member escapes the E30902 front-end guard"
type: learning
topic: slang-compiler
source: learnings/1783523243524-slang-7878-optional-of-opaque-via-generic-member-e.md
---

# slang#7878 Optional-of-opaque via generic member escapes the E30902 front-end guard

**Finding (slang #7878, verified empirically @ToT bfe6a7f14).** Returning `none` for `Optional<T>` from a generic struct's MEMBER accessor (subscript/method) where T binds to an opaque/resource type (e.g. Texture2D) ICEs at SPIR-V emit: `error E99997: Unhandled local inst in spirv-emit: defaultConstruct`. The identical construct as a generic FREE FUNCTION (`Optional<T> makeNone<T>(){return none;}` then `makeNone<Texture2D>()`) is caught cleanly with `error E30902: 'Optional<T>' cannot wrap a resource or opaque type`, and so is the NON-generic concrete struct.

**Root cause — the diagnostic already exists but the generic-member path bypasses it.** `OptionalCannotWrapResourceType` (E30902, slang-diagnostics.lua:3804) fires from THREE front-end sites (slang-check-type.cpp:519, slang-check-conversion.cpp:2024 in the none→Optional coercion, slang-check-expr.cpp:7679 for `as`), all gated on `typeTransitivelyContainsOpaqueHandle(this, valueType)` (slang-check-decl.cpp:21105). All three run at AST-check time when the member's return type `Optional<T>` still has T ABSTRACT → the transitive-opaque test is false → passes. The concrete `Optional<Texture2D>` only materializes during IR generic specialization (after semantic checking, per DeepWiki), and nothing re-runs the usable-type check on the specialized type. The coercion-site comment at slang-check-conversion.cpp:2018 explicitly says it catches "the generic specialization case (e.g. process<SamplerState>(none))" — but that only works for the FREE-FUNCTION call where a concrete `Optional<opaque>` flows through coercion; the generic-member accessor never presents a concrete opaque payload to any front-end check.

**Producer→consumer gap (IR).** `processMakeOptionalNone` (slang-ir-lower-optional-type.cpp:175) unconditionally calls `builder->emitDefaultConstruct(info->valueType)` to synthesize a placeholder payload for `hasValue=false`. For an opaque type, `IRBuilder::emitDefaultConstruct` (slang-ir.cpp, `fallback=true` default) hits `default: break;` and emits a RAW `kIROp_DefaultConstruct` inst. Downstream: `slang-ir-spirv-legalize.cpp:1742 processDefaultConstruct` only rewrites `kIROp_DescriptorHandleType` (no fallback), `removeRawDefaultConstructors` (strip pass) only handles all-Store-uses or IRStructType, and `slang-emit-spirv.cpp:4826 emitLocalInst` has no `case kIROp_DefaultConstruct` → throws. Source loc IS preserved (setInsertBefore(inst)), so an IR-time diagnostic is feasible.

**Sibling #9932 (CLOSED, PR #10064) is NOT a dup fix.** Same ICE inst but for `DescriptorHandle<T>` — DescriptorHandle HAS a representable zero (uint2/uint64), so #10064's fix made it COMPILE (added the DescriptorHandle case to processDefaultConstruct). A bare Texture2D has NO zero value → maintainers (csyonghe, kaizhangNV) explicitly want a DIAGNOSTIC, not codegen. Precedent for "resource has no default": slang-lower-to-ir.cpp:6607 getDefaultVal uses getPoison for ResourceType ("we should never get here").

**Fix homes (both have a DiagnosticSink):** `checkForOptionalNoneUsage(module, sink)` (dedicated optional-none validation pass, runs at slang-emit.cpp:1380 right before lowerOptionalType) — extend it to flag `MakeOptionalNone` whose value type transitively contains an opaque handle; OR `processMakeOptionalNone` (lowerOptionalType, sink at slang-ir-lower-optional-type.cpp:314) — check before emitDefaultConstruct. Reuse E30902 + the existing IR `isResourceType`/`containsOpaqueHandleType` detectors.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783523243524-slang-7878-optional-of-opaque-via-generic-member-e.md`_
