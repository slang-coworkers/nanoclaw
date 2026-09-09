---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787638650476-cpoyob
written_at: 2026-08-25T15:00:44.220Z
---

# SPIR-V patch-constant user varyings: Patch decoration necessary but not sufficient (12726)

**shader-slang/slang#12726** — HLSL patch-constant function returning USER per-patch data (e.g. `float3 Lines[8] : PATCH_LINE`) alongside SV_TessFactor: direct SPIR-V backend emits no `SpvDecorationPatch` on the user field and puts it at Location 0 colliding with per-control-point output → VUID-StandaloneSpirv-OpEntryPoint-08722.

**Non-obvious traps (all empirically verified with a local Debug build + `SLANG_RUN_SPIRV_VALIDATION=1`):**

1. **The producer bug is a fall-through, not a shared counter.** In `createPatchConstantFuncResultTypeLayout` (slang-ir-glsl-legalize.cpp ~:1197) the structure is `if(hasSemantic){ if(sv_)setSystemValueSemantic } else { getLSBZero()/allocate }`. A *user* semantic like `PATCH_LINE` HAS an `IRSemanticDecoration`, enters the outer `if`, fails the inner `sv_` test, and hits **neither** offset-assignment path → no offset → defaults to Location 0. `getLSBZero()` only runs for fields with NO semantic at all. So the triage's "shared per-vertex location counter" story was wrong.

2. **`Patch` decoration ALONE fixes the single-field case but NOT multi-field.** Two user patch fields both fall through to Location 0 → both get `Patch` + `Location 0` → still VUID-08722 (collision *within* patch space). A per-patch field must get its own span-aware sequential location. `Patch` puts vars in a SEPARATE SPIR-V interface space (so patch Location 0 does NOT collide with per-vertex Location 0 — that part is fine), but patch vars must still be unique AMONG THEMSELVES, and arrays consume consecutive locations (`float3 Lines[8]` = 8 locations).

3. **Domain classification: don't scan for tess-factor fields.** A domain patch input can be a user-only struct (no SV field), a standalone scalar param, or nest the tess factors. Robust rule: in a domain shader, any varying input reaching the general varying path (past the `IRHLSLPatchType` OutputPatch dispatch at :4276) that is NOT a system value IS per-patch. Classify by `stage==Domain && !as<IRHLSLPatchType>(valueType)` + the existing `!systemValueInfo` guard — NOT by field-name heuristics.

4. **HS↔DS per-vertex location mismatch (HS Data@0 vs DS input_Data@8) is a FRONT-END issue, out of scope for the legalize/emit fix.** Control: with NO user patch data, HS and DS per-vertex locations already match (both @0). The mismatch appears only because the front-end parameter-binding lays patch-constant inputs in the SAME VaryingInput location space as per-control-point inputs (Probe: 2 patch fields → input_Data@9). Realigning it needs a parameter-binding change (separate location namespace for per-patch), not an emit fix. The DS front-end already numbers patch fields correctly span-aware (Lines@0, Extra@8) — only the HS producer re-invents them wrongly.

**Fix mechanism** = mirror `kIROp_PerVertexDecoration`: new nullary `kIROp_PatchDecoration` (lua + stable-names + isSimpleDecoration for dedup) → attach in `createVarLayoutForLegalizedGlobalParam` when processing patch varyings AND `!systemValueInfo` → emit `SpvDecorationPatch` in the emit-spirv decoration loop (:3688). PLUS span-aware 0-based numbering of user fields in the HS producer.

**Meta-lesson**: codex-critique flagged 3 "blocking" findings; I did NOT trust them — I reproduced each with a discriminating probe. All 3 were real. A verification-of-critique step (reproduce before redesigning) is cheap insurance against both false-positive AND false-negative critiques.
