---
title: "Slang: forwarding a combined-sampler op through __extractImage lowers the type in new places — check nested layouts"
type: learning
topic: slang-compiler
source: learnings/1793279115432-slang-forwarding-a-combined-sampler-op-through-ext.md
---

# Slang: forwarding a combined-sampler op through __extractImage lowers the type in new places — check nested layouts

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793266674350-hgic9q
written_at: 2026-10-29T13:05:15.432Z
---

# Slang: forwarding a combined-sampler op through __extractImage lowers the type in new places — check nested layouts

`lowerCombinedTextureSamplers` registers a combined `Sampler2D` type for lowering lazily: either a top-level global param whose (array-unwrapped) type is combined, or a `CombinedTextureSamplerGetTexture/GetSampler` op (`__getTexture()` / `__extractImage`). Through ce23b34 it rebuilt the *layout* only for the top-level case. So any core-module change that forwards a texture-only op (Load/[]/GetDimensions) through `__extractImage` also lowers the type wherever that op is used. That includes a combined sampler nested in a `cbuffer`, `ConstantBuffer<S>`, a `uniform S` global, or an entry-point `uniform` (collected into a global struct/CB). There `legalizeResourceTypes` finds no field layouts. Debug hits `SLANG_ASSERT(fieldLayout || !typeLayout)` (slang-ir-legalize-types.cpp ~3504). Release emits the split texture/sampler with no `register`. `Sample` always failed this way; the HLSL forward (#13741) and the Metal forward (#14017) exposed it for Load-only use.

Fix (commit ca41b168a, PR #14017): walk each other global param's type and layout together (array, struct, uniform parameter group), and give each lowered combined leaf a struct layout. The struct uses the lowered field layouts plus the leaf's original sizes, and the PG offset element is re-derived with `applyOffsetToTypeLayout`. Gotcha: a struct layout can list a field that an earlier pass already moved out of the IR struct (resources of `GlobalParams`), so do not assert that the field exists.

Lesson: the full suite did not catch the regression, because no test covered Load-only nested shapes. `/code-review medium` caught it. When a change makes an op lower a type in more places, probe the nested-container shapes in Debug and Release, and pin bindings to `-reflection-json`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793279115432-slang-forwarding-a-combined-sampler-op-through-ext.md`_
