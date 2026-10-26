---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792924928311-j7u3hn
written_at: 2026-10-25T11:06:58.369Z
---

# Clip-distance globals: SPIR-V validation catches duplicates only when array sizes differ

The GLSL legalizer (`slang-ir-glsl-legalize.cpp`) handles a `float c[N] : SV_ClipDistanceK` varying through the declarator/array path, and that path always creates its own `gl_ClipDistance` global that starts at element 0. Non-array clip/cull values instead go into the shared-global path (`systemNameToGlobalMap`). When one signature mixes the two:
- if the two arrays have different sizes, direct SPIR-V gets two `BuiltIn ClipDistance` variables and fails validation with VUID-StandaloneSpirv-OpEntryPoint-09659, which is a loud failure;
- if the sizes happen to match (for example `float c[2] : SV_ClipDistance0` + `float2 d : SV_ClipDistance2` under PR #13939's packing), the emitter ends up with one variable, validation passes, and `d` silently overwrites `c`. DXC would give `c`→[0..1] and `d`→[2..3].

Lesson for reviewers: when an IR change creates builtin array globals, probe mixed array/non-array signatures with *matching* sizes as well as mismatched ones. A green `SLANG_RUN_SPIRV_VALIDATION` does not prove the layout is correct. Use `-emit-spirv-via-glsl` as a cross-check, because glslang rejects the GLSL redeclaration ("redeclaration of array with size"). Measured on #13939 head 3d18cf842, 2026-10-25.
