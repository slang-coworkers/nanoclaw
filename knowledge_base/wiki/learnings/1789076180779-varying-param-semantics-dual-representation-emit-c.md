---
title: "Varying-param semantics: dual representation + emit-consumer map (layout vs IR struct-field decoration)"
type: learning
topic: misc
source: learnings/1789076180779-varying-param-semantics-dual-representation-emit-c.md
---

# Varying-param semantics: dual representation + emit-consumer map (layout vs IR struct-field decoration)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789075717266-vrw40c
written_at: 2026-09-10T21:36:20.779Z
---

# Varying-param semantics: dual representation + emit-consumer map (layout vs IR struct-field decoration)

Verified at slang HEAD 578d571f9 (2026-09-10) while triaging the #12998 design issue (proper fix for the #12997 Metal mesh/frag `[[user(...)]]` mismatch).

**Dual representation of a varying param's semantic (the root of the divergence class):**
- Verbatim path: `addSemanticDecoration` attaches an `IRSemanticDecoration` to IR struct fields during AST→IR lowering (`slang-lower-to-ir.cpp:3235` modifier, `:13034` struct-field key), storing the source spelling as-written with **index = -1 (no name/index split)** — e.g. `"TEXCOORD1"`.
- Normalized path (the layout source of truth): `setUserSemantic(varLayout->semanticName, varLayout->semanticIndex)` (`slang-lower-to-ir.cpp:16591`) writes the split `(name,index)` into the entry-point VarLayout.
These two diverge whenever a code path bypasses the reconciling pass.

**The reconciling pass is Metal+WGSL-only.** `fixFieldSemanticsOfFlatStruct` (`slang-ir-legalize-varying-params.cpp:3800-3980`) runs ONLY inside `LegalizeShaderEntryPointContext`, subclassed only by Metal + WGSL. Beyond name/index canonicalization it owns 3 kinds of overlap/offset de-dup + remap bookkeeping: field `IRSemanticDecoration` dup → `_returnNonOverlappingAttributeIndex`; `IRVarOffsetAttr` dup offset → `_replaceAttributeOfLayout`; `IRUserSemanticAttr` dup index → reassign; plus `oldLayoutDecorToNew` remap. If you ever remove this pass, that bookkeeping "needs a home."

**Who actually reads the field-level `IRSemanticDecoration` at emit (sizes any "audit every consumer"):**
- HLSL (`slang-emit-hlsl.cpp:2225`) — direct read. Real dependency.
- WGSL (`slang-emit-wgsl.cpp:294`) — direct → `@location(index)`. Real dependency.
- Metal (`slang-emit-metal.cpp:1699/1709`) — **layout-first**; reads varLayout `IRSemanticAttr` at :1699 and only *falls back* to the field decoration iff `!hasSemantic`. That fallback path is exactly what the mesh legalization bypasses, producing #12997.
- SPIR-V (`slang-emit-spirv.cpp:6908/6917`, `:7058-7070`) — reflection-only, under `shouldEmitSPIRVReflectionInfo()`.
- GLSL + CUDA — do NOT read it (GLSL/SPIR-V source varying semantics from VarLayout by declaration order).

**NV_ compat gotcha:** the front-end treats BOTH `sv_`/`nv_` prefixes as system-value (`slang-parameter-binding.cpp:2024`, on a lowercased name). Any semantic-normalization work must preserve `NV_`.

**No duplicate-user-semantic diagnostic exists today** — only SV checks in `slang-check-shader.cpp`; overlapping user semantics are silently re-indexed via `_returnNonOverlappingAttributeIndex`, which is what produces the `BAR`/`BAR_1` Metal drift.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789076180779-varying-param-semantics-dual-representation-emit-c.md`_
