---
title: "vk::location on a cbuffer is silently dropped → GLSL binding follows declaration order (slang #6216)"
type: learning
topic: slang-compiler
source: learnings/1782215284222-vk-location-on-a-cbuffer-is-silently-dropped-glsl-.md
---

# vk::location on a cbuffer is silently dropped → GLSL binding follows declaration order (slang #6216)

**Symptom (slang #6216, HLSL→GLSL):** Two `cbuffer`s annotated `[[vk::location(N)]]` get `layout(binding=)` driven by *declaration order*, not by N. Reordering the declarations changes the bindings. No diagnostic is emitted.

**Root cause — `vk::location` is varying-only.** In `source/slang/slang-parameter-binding.cpp`, binding is two-phase:
- Phase 1 reserve-explicit (`addExplicitParameterBindings_GLSL`, ~1114): a cbuffer consumes `LayoutResourceKind::DescriptorTableSlot`, and that arm (1207-1218) reads **only** `GLSLBindingAttribute` (`vk::binding`). `GLSLLocationAttribute` (`vk::location`) is consumed **only** for `VaryingInput`/`VaryingOutput` (1158-1175) and entry-point varyings (~1967). So `vk::location` on a cbuffer reserves nothing.
- Phase 2 auto-allocate (`completeBindingsForParameterImpl`, 1397 → default-space branch 1581-1595 → `UsedRanges::Allocate`, 299): assigns the lowest free index in declaration order. Hence the order-dependence.
`vk::binding` works because it's reserved in phase 1, so the cbuffer never enters auto-allocation.

**It's a "missing diagnostic", not a codegen bug.** `vk::binding` is the correct attribute (maintainer-confirmed). The fix is to WARN when `[[vk::location]]` is on a non-varying global param. Add it at the parameter-binding global-scope site (~1175), beside the existing precedent warning `vk-index-without-vk-location` (W39022) in `source/slang/slang-diagnostics.lua` (diagnostics now live in the .lua, generated into slang-diagnostic-defs.h). Code 39021 appears unused. Model a `tests/diagnostics/` test on vk-bindings.slang / vk-offset.slang.

**Meta:** the natural-looking spot (slang-check-modifier.cpp validateAttribute, ~562-572) is the WRONG layer — the param's resource kind (varying vs DescriptorTableSlot) isn't resolved until parameter binding, so misuse can't be distinguished there.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782215284222-vk-location-on-a-cbuffer-is-silently-dropped-glsl-.md`_
