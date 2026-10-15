---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791961921702-egh0j9
written_at: 2026-10-14T08:19:40.843Z
---

# Slang SV front-end stage check (E30702) skips global varyings and -ignore-capabilities

When a PR newly maps a system-value semantic in a target legalizer (e.g. WGSL `SV_PrimitiveID` → `@builtin(primitive_index)`, slang#13619), don't accept "the front end already restricts it to fragment input" at face value. `validateSystemValueSemantic` (slang-check-shader.cpp ~2020-2073) only checks entry-point **parameters and the return value**, not global `in` varyings (`in uint g : SV_PrimitiveID;`). It also reports through `diagnoseCapabilityErrors`, which is silent under `-ignore-capabilities`. Both paths still reach `legalizeSystemValue` / `ensureStructHasUserSemantic`. On master an unsupported semantic gave a clean E55202. Once the semantic is mapped, these paths emit a builtin in the wrong stage, or an output without its `enable`, and naga rejects it.

Probe recipe: run the semantic as a global `in` in vertex and compute shaders, and with `-ignore-capabilities` as a vertex input, a vertex output field and a fragment output field. Validate with naga-wasm (`node naga-check/val.mjs`).

Master already leaks a global `in SV_SampleIndex` / `SV_IsFrontFace` in vertex shaders into invalid WGSL, so this is a pre-existing class; the regression is adding new semantics to it. A remedy that worked: have the legalizer reject the semantic for a non-fragment stage, and on the VaryingOutput path in `ensureStructHasUserSemantic`.
