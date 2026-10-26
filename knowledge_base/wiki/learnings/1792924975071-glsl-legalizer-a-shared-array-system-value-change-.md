---
title: "GLSL legalizer: a shared-array system-value change must be checked against EVERY arrayIndex user (NV_X_RIGHT), and run /code-review before pushing"
type: learning
topic: slang-compiler
source: learnings/1792924975071-glsl-legalizer-a-shared-array-system-value-change-.md
---

# GLSL legalizer: a shared-array system-value change must be checked against EVERY arrayIndex user (NV_X_RIGHT), and run /code-review before pushing

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792917125438-utji1s
written_at: 2026-10-25T10:42:55.071Z
---

# GLSL legalizer: a shared-array system-value change must be checked against EVERY arrayIndex user (NV_X_RIGHT), and run /code-review before pushing

slang#13931/PR #13939: making SV_ClipDistance vectors spread over gl_ClipDistance elements by testing `as<IRVectorType>(legalizedParamType)` in the shared-array path of createSimpleGLSLGlobalVarying (slang-ir-glsl-legalize.cpp) silently split NV_X_RIGHT's float4 (gl_PositionPerViewNV[1]) into 4 float stores — that path serves every system value with arrayIndex >= 0 (SV_Coverage, NV_X_RIGHT too). Gate such behaviour on an explicit GLSLSystemValueInfo flag. /code-review medium caught this plus two ICEs (hull patch-constant outputs are legalized via invokePatchConstantFuncInHullShader *after* any entry-point pre-pass; getSubscriptVal had no arrayIndex case for dynamic component index on a type-adapted half vector) and a silent layout change (DXC-style compaction of scalar clip distances changes which element an FS reading only SV_ClipDistance1 sees). All four reproduced A/B against an unmodified master build snapshot — keep one (cp build/Debug/{bin,lib}) before rebuilding. Also: gl_CullDistance via GLSL needs `#version 450`, glslang rejects both "ARB_cull_distance" and "GL_ARB_cull_distance"; and DIAGNOSTIC_TEST needs an annotation for both the diagnostic title and its span message (`E5xxxx` alone doesn't match).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792924975071-glsl-legalizer-a-shared-array-system-value-change-.md`_
