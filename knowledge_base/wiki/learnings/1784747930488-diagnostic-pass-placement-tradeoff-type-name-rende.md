---
title: "Diagnostic pass placement tradeoff: type-name rendering vs dead-code false-positives (SPIR-V legalize)"
type: learning
topic: slang-compiler
source: learnings/1784747930488-diagnostic-pass-placement-tradeoff-type-name-rende.md
---

# Diagnostic pass placement tradeoff: type-name rendering vs dead-code false-positives (SPIR-V legalize)

**Context:** slang#12185 / PR #12186. I added a pass in `legalizeIRForSPIRV` (slang-ir-spirv-legalize.cpp) that diagnoses `CastDescriptorHandleToResource` result types the `spvBindlessTextureNV` extension can't encode. A reviewer asked "should this run after DCE so dead code (after `discard`) isn't diagnosed?" Chasing that exposed a real pass-ordering tension worth remembering:

- **Run the diagnostic EARLY (start of legalizeIRForSPIRV):** the resource type name still renders (`of type 'RWStructuredBuffer<float>'`), because `legalizeSPIRV`→`lowerBufferElementTypeToStorageType` hasn't yet erased/rewritten the buffer element type. BUT dead-after-`discard` code is still present and gets a false-positive diagnostic.
- **Run it LATE (after removeUnreachableCodeAfterDiscardForOpKill + eliminateDeadCode):** dead code is gone (no false positive), BUT the buffer element-type lowering has already run, so `getTypeNameHint` returns empty → diagnostic prints `of type ''`. Regression.

So "run after DCE" and "report the type name" trade off against each other at the pass level. You can't get both by just moving the call.

**Also non-obvious:** an `IRUnreachable`-terminator block skip does NOT catch the dead-after-`discard` case at the early point, because (a) the `discard`→unreachable-block split happens later (in `removeUnreachableCodeAfterDiscardForOpKill`), and (b) `getDescriptorFromHandle` is `[ForceInline]` and NOT yet inlined early — so the offending cast lives in a *live* concrete specialization of the helper, not in the dead post-discard block. Skipping unreachable blocks or checking findOuterGeneric both miss it. A true fix needs call-graph reachability from live entry points.

**Rule / how to apply:** when placing a validation/diagnostic pass that reports a *type name*, place it BEFORE type-lowering passes (buffer-element-type lowering erases resource type names). If you also need to exclude dead code, don't rely on block-terminator or DCE ordering — you need reachability analysis, OR capture the type-name string early and defer only the emit. When the two goals genuinely conflict and the dead-code case is narrow, surface the tradeoff to the maintainer and let them choose rather than shipping a hacky half-fix. (I reverted a broken unreachable-skip attempt rather than ship it.)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784747930488-diagnostic-pass-placement-tradeoff-type-name-rende.md`_
