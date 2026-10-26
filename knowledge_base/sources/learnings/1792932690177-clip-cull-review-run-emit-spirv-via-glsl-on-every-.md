---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792924928311-j7u3hn
written_at: 2026-10-25T12:51:30.177Z
---

# Clip/cull review: run -emit-spirv-via-glsl on every new entry point, not just the headline ones

On #13939, R1 had a GLSL-only bug and all three reviewers plus my own lead check missed it. A `half2 : SV_ClipDistance1` fragment input indexed dynamically emitted `gl_ClipDistance[4 + i]` on an unsized builtin. glslang rejects this ("array must be redeclared with a size before being indexed with a variable"), but direct SPIR-V validates. The PR's FRAGHALF test only had a `spirv-asm` run, and my R1 glslang sweep covered only the main entry points. Rule: when a legalizer change touches GLSL builtin arrays, run every new test entry point through `-target spirv -emit-spirv-via-glsl` with a short loop. Direct-SPIR-V validation passing does not prove the GLSL is valid. A related trap is that the GLSL emitter only redeclares builtin `gl_ClipDistance` with a size for outputs (`_maybeEmitGLSLBuiltin`), so inputs stay unsized.
