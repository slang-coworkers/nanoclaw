---
name: project_12169_glsl_global_geo_input_realglobalvar
description: "slang#12169 GLSL global-scope geo array-of-struct input → realGlobalVar assert; triaged→fixer"
metadata: 
  node_type: memory
  type: project
  originSessionId: cce94fc1-4c8e-45d9-908c-6de4d1d2d932
---

# shader-slang/slang#12169 — GLSL global-scope geometry input asserts `realGlobalVar`

Opened 2026-07-21 by **pdeayton-nv**. Canonical thread `gh-issue-shader-slang/slang-12169`.

**Repro:** `in triangle CoarseVertex coarseVertices[3];` (GLSL-style global-scope geo input, **array-of-struct**) → `slangc repro.slang -target spirv` aborts:
`slang-ir-glsl-legalize.cpp(4401): realGlobalVar` (E99997 InternalError). Env `v2026.13.1-62-g6a244fee2`.

**Triage verdict (slang-triager, 07-21):** bug / medium / IR GLSL-SPIR-V varying legalization / P2. REPRODUCED at HEAD; fires with `-O0` and on `-target glsl` too → inside IR legalize pass, not SPIR-V-specific. Trigger isolated empirically: plain-struct + array-of-vector globals compile; **only array-of-struct** crashes. Same shape works as entry-point param → legalize gap, not unsupported form. Labeled `reproduced` + Type=Bug.

**Premature-close link:** this is `failure2.slang` from #9058. PR #11678 (`Fixes #9058`) fixed only the reordered-param `failure1.slang` and closed #9058. Tracking fresh under #12169; reopening #9058 is maintainer's call (bot won't auto-reopen).

**Solution space (triage memo `triage-12169.md`):** A (recommended) broaden `as<IRStructType>` guard at glsl-legalize :4358 to route array-of-aggregate through `tryReplaceUsesOfStageInput`; B producer-side key fix; C diagnostic fallback.

**Fix (slang-fixer, 07-21):** draft **PR #12170** open, held pending review. 2 files +40/−36 in `slang-ir-glsl-legalize.cpp` `legalizeEntryPointParameterForGLSL`: discriminate global-scope varying-input legalization on scalarized `flavor == tuple` instead of `as<IRStructType>(globalVarType)` → plain-struct AND array-of-struct both route through `tryReplaceUsesOfStageInput`; removed dead tuple key-match + unused locals; new regression test. Repro PASSes post-fix on spirv + glsl targets; broad suite 0 fails. Codex PLAN/CODE/OUTPUT approve. Approach A (consumer-side); B/C rejected. `report_pr_created(12170)` confirmed → webhooks route to fixer session. `ci_failed` webhook = benign draft priority-yield (cosmetic red), not real.

**State (07-21):** Orchestrator dispatched **slang-reviewer** (correctness pass) against PR #12170 on canonical thread — fixer couldn't reach reviewer (no session/edge; routing-gate). Topology stays tiered: orch relays must-fix findings back to fixer (max 2 rounds), or notes clean → hold for human ready-flip. Await slang-reviewer verdict.
