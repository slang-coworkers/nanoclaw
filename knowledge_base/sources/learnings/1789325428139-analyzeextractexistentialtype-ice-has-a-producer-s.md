---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789324794366-dywpv1
written_at: 2026-09-13T18:50:28.139Z
---

# analyzeExtractExistentialType ICE has a producer-side root (isConcreteType lacks a union case), not just the consumer gate

The `E99997 ... Unhandled info type in analyzeExtractExistentialType` ICE family (issue #12934, in-flight consumer-side PR #12935) also has a **distinct producer-side trigger** (issue #13046, autodiff-free, no nested hit-info).

Mechanism, all in `source/slang/slang-ir-typeflow-specialize.cpp` (verified @ a90dfa311):
- `isConcreteType` (~:585-602) has NO case for `kIROp_TaggedUnionType`/`kIROp_UntaggedUnionType` → falls through `default: return true`, so an already-lowered `IRTaggedUnionType` is mis-classified as "concrete".
- `propagateInterproceduralEdge`'s FuncToCall concrete-return fallback (~:2158-2176) then passes that already-refined union to `makeInfoForConcreteType`.
- `makeInfoForConcreteType`'s entry `SLANG_ASSERT(isConcreteType(type))` (~:615) wrongly passes (same misclassification); its bottom fallthrough (~:704-706) re-wraps as `UntaggedUnionType(TypeSet(TaggedUnionType(...)))`.
- `analyzeExtractExistentialType` (~:3749) happy path (~:3778) only matches a BARE `IRTaggedUnionType`; the doubly-wrapped shape hits `SLANG_UNEXPECTED` at ~:3781.

Why the consumer-side fix (PR #12935: tolerate a singleton untagged-union) is insufficient here: prior learning + this triage agree a consumer mirror just relocates the ICE downstream to `emitGetTypeTagFromTaggedUnion` (multi-element path ~:6109); an element-of-set element should be concrete, not another union. The principled fix is producer-side: don't re-wrap an already-lowered union (fix `isConcreteType`, or short-circuit in `makeInfoForConcreteType`/the fallback), then the bare tagged union reaches the happy path.

User-side workaround (temporary, not a compiler fix): `[__unsafeForceInlineEarly]` on the shared interface-returning factory inlines it BEFORE the specialization phase lowers its return to a tagged union, so no shared func return gets lowered and the re-wrap never happens. Ordinary `[ForceInline]`, bypassing forwarders, or inlining the initializer do NOT help — the annotation must be `__unsafeForceInlineEarly` on the factory.

Repro is GPU-free (compile to HLSL, front-end/IR crash) and version-robust: reproduces on Release v2026.13.1-50-g3649fb982 (older than the reporter's v2026.17.1).
