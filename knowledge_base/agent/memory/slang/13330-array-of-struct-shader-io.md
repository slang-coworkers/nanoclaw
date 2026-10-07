---
type: chain
title: slang#13330 — array-of-struct shader IO field crashes SPIR-V/GLSL
description: Triaged + reproduced; two defects in legalizeEntryPointsForGLSL; fixer HELD because the external reporter is co-assigned
tags: [slang, spirv, glsl, varying-legalization, parked]
resource: /workspace/inbox/a2a-1790714475432-85ez5y/triage-13330.md
---

# slang#13330 — array-of-struct shader IO (parked)

Reporter georgeouzou (external). `struct VSOut { float4 pos : SV_POSITION0; Nested n[2] : NESTED_ATTR; }`
→ `-target spirv` E99997 (`void_constant` in spirv-emit), `-target glsl` E99999. HLSL/Metal/WGSL
compile. Not a regression (2025.23.2/2025.24 segfault).

**Mechanism (triager; its posted comment matches):** `legalizeEntryPointsForGLSL` SoA-splits
`Nested n[2]` into `n.a:float[2]`, `n.b:float[2]`.
1. Output crash: `assign()` (slang-ir-glsl-legalize.cpp:2604) → `extractField` on an array value hits
   the PR #10283 null guard (:2352) → empty value → `store(…, void_constant)`. The per-element fix
   (aa3217fa6) was dropped before merge (f6e762fc2).
2. New, not in the report: the input side emits overlapping Locations (a@0, b@1, each float[2]), which
   spirv-val rejects (08721). The field offset (:2216-2223) is not scaled by the array count.
   Reflection and DXC are element-major.
Both have to be fixed together. Recommended A (array-aware write + loud failure) + B1 (per-element-
per-field vars, element-major); B1 vs B2 (one DXC-style `Nested[2]` varying) is for the maintainers.

**State 2026-09-29 ~20:41Z:** triage comment
[5898420450](https://github.com/shader-slang/slang/issues/13330#issuecomment-5898420450); labels
`reproduced`, `SPIR-V`, `GLSL`; milestone Q4 2026 (Fall). Assignees: jhelferty-nv **and the reporter
georgeouzou**, who was co-assigned after my 20:16Z read. slang-fixer HELD with an A+B1 briefing.

**Decision (Orchestrator): hold the fixer.** A maintainer co-assigning an external reporter signals the
reporter may send the fix. A bot PR would compete with it (assigned-human stand-down rule).
Release only on an explicit ask for a bot PR, or if the reporter declines.

**Re-chase 1 (2026-10-06T21:00Z, `rechase-13330-assignee-c133`): no change.** No comments, no #13330 PR,
same assignees. One signal: the reporter's separate open PR #13078 (hull patch-constant outputs, Fixes
#12726) adds a TODO in `createPatchConstantFuncResultTypeLayout` that points at #13330 ("take this case
into account when fixing it"). So the reporter knows about it but hasn't committed to a PR. jhelferty-nv
pinged them on #13078 on 10-06. Dashboard told. **Re-chase 2 `rechase-13330-second-f513` fires
2026-10-13T21:00Z.** If that one is also silent, it asks the operator (ask_user_question) whether to ask
on the issue.

Unverified side note (triager, not posted): WGSL/Metal emit `array<Nested,2>` user IO, likely invalid there.
