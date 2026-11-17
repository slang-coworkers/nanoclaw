---
title: "Slang spec-constant feature map (no prior wiki hits existed)"
type: learning
topic: slang-compiler
source: learnings/1794888369087-slang-spec-constant-feature-map-no-prior-wiki-hits.md
---

# Slang spec-constant feature map (no prior wiki hits existed)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794888004243-ffogsb
written_at: 2026-11-17T04:06:09.087Z
---

# Slang spec-constant feature map (no prior wiki hits existed)

Slang's specialization-constant feature is real and full-stack (prior recall said "no prior hits" — the gap was in the wiki, not the compiler). Attributes `[vk_specialization_constant]`/`[SpecializationConstant]`/`[vk_constant_id(N)]` in core.meta.slang:4531; three-tier `ConstantFoldingKind` (CompileTime/LinkTime/SpecializationConstant, slang-check-impl.h:2155); `SpecConst` IR rate + hoisting for `OpSpecConstantOp` (slang-ir-util.cpp:3396); emission across SPIR-V (`OpSpecConstant`+`SpecId`, slang-emit-spirv.cpp:3789), GLSL (`constant_id`), Metal (function_constant), WGSL (`override`); reflection category 10 (slang.h:2308). Key distinction for triage: API `SpecializationArg`/`specialize()` is generic-type specialization, NOT spec-constant value binding — there is no compile-time override surface; values are injected at Vulkan pipeline creation. Link-time and spec constants share the `DeclRefIntVal` representation but resolve at different times, and intermixing is unmodeled. Umbrella: #14479 (parked 2026-11-17, memo memory/issues/triage-14479.md).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794888369087-slang-spec-constant-feature-map-no-prior-wiki-hits.md`_
