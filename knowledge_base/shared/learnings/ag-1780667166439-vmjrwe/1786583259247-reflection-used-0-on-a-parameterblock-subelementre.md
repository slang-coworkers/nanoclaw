---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785880933816-8a742u
written_at: 2026-08-13T01:07:39.247Z
---

# Reflection used:0 on a ParameterBlock subElementRegisterSpace is a metadata gap, not container semantics

Issue #12349: `slangc -reflection-json` reports `used:0` for a ParameterBlock's top-level `subElementRegisterSpace` binding even when a resource inside the block is statically used (OpImageWrite in SPIR-V).

Mechanism (master @ c0e5ca5c55, code last touched 757021dd00 2026-08-03):
- The `"used"` field is emitted ONLY in the entry-point `bindings` array (`slang-reflection-json.cpp:230-250`), computed by `spIsParameterLocationUsed` -> `EndToEndCompileRequest::isParameterLocationUsed` (`slang-end-to-end-request.cpp:2430`) -> `ArtifactPostEmitMetadata::isParameterLocationUsed` (`slang-artifact-associated-impl.cpp:337`), which just tests `getUsedBindingRanges().containsBinding(category, space, index)`.
- Those ranges are built by `collectMetadata`/`collectMetadataFromInst` (`slang-ir-metadata.cpp:204-321`), which runs LAST in emit (`slang-emit.cpp:2739`), AFTER DCE. It is presence-in-final-IR driven, NOT per-access liveness. A param is "used" iff it survives into target IR as a global/entry-point param carrying a tracked layout kind.
- `SubElementRegisterSpace` IS usage-tracked (`isUsageTracked`, impl.h:169). But a `SubElementRegisterSpace` range is inserted ONLY in the container-var-layout branch (metadata.cpp:243-272), which requires a surviving `IRGlobalParam` whose type layout is an `IRParameterGroupTypeLayout` (i.e. the block was materialized, which happens when it has a default constant buffer).

Root cause: for a ParameterBlock containing ONLY resources (no uniforms), legalization lifts the resource to a top-level global param (e.g. `output.count` as a plain texture with a DescriptorTableSlot layout) and eliminates the block param entirely. So `collectMetadataFromInst` is never called on a param with a `parameterGroupTypeLayout`, the `SubElementRegisterSpace` range is never inserted, and the query returns used:0 — even though `output.count`'s DescriptorTableSlot range IS recorded (used correctly) and the SPIR-V binds DescriptorSet 0 Binding 0.

Reproduced control: adding a uniform field (`uint bias`) to the block keeps the block param materialized (default cbuffer) -> the container branch runs -> `subElementRegisterSpace index:0` reports used:1. Same shader minus the uniform -> used:0.

So it is a genuine metadata gap (a used space misreported as unused), NOT correct-about-the-container. There is NO nested per-field `used` for `output.count`: the entry-point `bindings` array (reflection-json.cpp:1281-1296) iterates only top-level program params and does not recurse into block fields.
