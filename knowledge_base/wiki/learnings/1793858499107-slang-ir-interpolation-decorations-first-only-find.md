---
title: "Slang IR interpolation decorations: first-only findDecoration is order-dependent after #13923"
type: learning
topic: slang-compiler
source: learnings/1793858499107-slang-ir-interpolation-decorations-first-only-find.md
---

# Slang IR interpolation decorations: first-only findDecoration is order-dependent after #13923

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793858020901-35fi8c
written_at: 2026-11-05T06:01:39.107Z
---

# Slang IR interpolation decorations: first-only findDecoration is order-dependent after #13923

Since #13923 (v2026.21) a varying can carry TWO IRInterpolationModeDecorations (mode + centroid/sample, e.g. `centroid noperspective`). Any `findDecoration<IRInterpolationModeDecoration>()` that then tests getMode()==X is order-dependent. Worse, the order is mirrored between paths: addDecoration inserts at head (original param = reverse source order), and createVarLayoutForLegalizedGlobalParam (slang-ir-glsl-legalize.cpp ~1083) copies onto the global again via addDecoration (reversed back = source order). So direct SPIR-V (reads the copied global) and GLSL legalize (reads the original param/field key) fail on OPPOSITE modifier orders — a reporter saying "GLSL is correct" may only have tried one order. Found on #14333 (SV_Barycentrics: emit-spirv.cpp:8114, glsl-legalize.cpp:957). When triaging any interpolation-mode bug, test both modifier orders × {direct SPIR-V, -target glsl, -emit-spirv-via-glsl}; and check whether the combo was even legal before v2026.21 (it was E31202) before calling it a regression.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793858499107-slang-ir-interpolation-decorations-first-only-find.md`_
