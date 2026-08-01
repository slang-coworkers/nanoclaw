---
title: "JSON reflection drops the global/entry-point scope's own container binding (the $Globals cbuffer)"
type: learning
topic: slang-compiler
source: learnings/1785535775197-json-reflection-drops-the-global-entry-point-scope.md
---

# JSON reflection drops the global/entry-point scope's own container binding (the $Globals cbuffer)

Verified @ slang master 744eb9ed4 while filing shader-slang/slang#12307 (maintainer tangent-vector design ask from PR #11135).

**The gap:** `slangc -reflection-json` iterates the FLAT `ProgramLayout::getParameterByIndex()` / `EntryPointReflection::getParameterByIndex()` lists in `emitReflectionJSON` / `emitReflectionEntryPointJSON` (source/slang/slang-reflection-json.cpp ~1314, ~1235). That flat list is exactly the API the reflection docs warn against, because it cannot account for the auto-introduced constant buffer / parameter block that wraps a scope. So when loose top-level uniforms are gathered into the `$Globals` constant buffer, the JSON reports them as bare `{"kind":"uniform","offset":0}` with NO containing buffer and NO binding for that buffer — and the descriptor slot the `$Globals` CB consumes (slot 0, pushing resources to 1,2,…) is an unexplained hole.

**The clean reference:** `examples/reflection-api/main.cpp` (its output is YAML-compatible per the top-of-file comment) does it right: ONE `printScope()` routine (line 676) is called uniformly for both `programLayout->getGlobalParamsVarLayout()` (line 661) and each `entryPointLayout->getVarLayout()` (line 747); it peels CB/ParameterBlock wrappers, emits the container's own binding, and recurses. NOTE: DeepWiki mis-identifies the "YAML reflection example" as `tools/slang-reflection-test` — it's actually `examples/reflection-api/main.cpp`. Trust the source.

**Reusable emit facts:** the JSON emitter ALREADY serializes container+element (`emitReflectionParameterGroupTypeLayoutInfoJSON` → containerVarLayout + elementVarLayout), but only when a *parameter's type* is a CB/PB, never for the *scope's own* wrapper. `emitReflectionVarLayoutJSON` (line 418) already emits name+type+binding, so feeding it a scope var-layout gets the container binding "for free". API methods getGlobalParamsVarLayout/getGlobalConstantBufferBinding/EntryPointReflection::getVarLayout/getContainerVarLayout all exist in include/slang.h.

**Repro (built slangc, -target spirv):** `float4 gTint; float gScale; Texture2D gTex; SamplerState gSamp;` + compute main → gTint uniform offset 0, gTex/gSamp at descriptorTableSlot 1/2, $Globals CB absent.

Proposed fix in #12307 = additive top-level `globalScope` + per-entry `scope` objects via one shared `emitReflectionScopeJSON`, keeping the flat lists for backwards-compat.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785535775197-json-reflection-drops-the-global-entry-point-scope.md`_
