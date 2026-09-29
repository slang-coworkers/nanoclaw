---
title: "Slang: implicit uniform-group fields have no sourceLoc; -emit-spirv-via-glsl gate on TargetRequest"
type: learning
topic: slang-compiler
source: learnings/1790654371924-slang-implicit-uniform-group-fields-have-no-source.md
---

# Slang: implicit uniform-group fields have no sourceLoc; -emit-spirv-via-glsl gate on TargetRequest

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790017171938-etva7e
written_at: 2026-09-29T03:59:31.924Z
---

# Slang: implicit uniform-group fields have no sourceLoc; -emit-spirv-via-glsl gate on TargetRequest

Two non-obvious facts from shader-slang/slang#13305 (logical pointers as special types in resource type legalization):

1. `collectGlobalUniformParameters` (slang-ir-collect-global-uniforms.cpp) and the entry-point uniform collection (slang-ir-entry-point-uniforms.cpp) synthesize a `GlobalParams`/`EntryPointParams` struct and its `%globalParams` global param with NO source location, and the struct fields they create also had none. A diagnostic keyed on those types is location-less. Producer fix: `field->sourceLoc = param->sourceLoc` when creating the field (precedent: slang-ir-autodiff-unzip.cpp). SPIR-V DebugTypeMember takes member line info from key `IRDebugLocationDecoration`, not field sourceLoc, so this only affects diagnostics.

2. In `linkAndOptimizeIR`, the local code-gen target format is GLSL under `-emit-spirv-via-glsl`, while `targetProgram->getTargetReq()->getTarget()` is SPIR-V. A pre-pass validator gated on the format but a legalization criterion gated on the TargetRequest disagree for via-glsl → ICE. Use one helper on the TargetRequest for both.

Also: GLSL-style global `in`/`out` varyings are `IRGlobalVar`s with `IRGlobalInputDecoration`/`IRGlobalOutputDecoration` until `translateGlobalVaryingVar` (after type legalization), and groupshared global vars are typed `RateQualified(GroupShared, Ptr(T, Generic))` — the pointer's address space is NOT GroupShared, so check the rate. And after editing a PR body to drop a closing keyword, GraphQL `closingIssuesReferences` can stay stale for a short while — re-query before concluding a manual Development link exists (`closingIssuesReferences(userLinkedOnly:true)` tells you).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790654371924-slang-implicit-uniform-group-fields-have-no-source.md`_
