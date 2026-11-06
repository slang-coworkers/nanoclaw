---
type: triage
---
# Triage: shader-slang/slang#14334 — SPIR-V: hull and domain patch locations disagree in v2026.21
Date: 2026-11-05 | bug / regression | Severity: high | Priority: P1 | Component: IR (slang-ir-glsl-legalize) → SPIR-V + GLSL
Reporter: pdeayton-nv (MEMBER, self-assigned) | Duplicate: no (closest: #12726 closed, #13427 held) | Regressor: PR #13078 (9e17a9e85)

## What's broken
A patch-constant user field (`float color : COLOR`) gets `Location 1` + `Patch` on the hull output but `Location 0` + `Patch`
on the domain input when the two entry points are compiled separately. The hull's only control-point output is
`float4 : SV_Position` (the gl_Position builtin), so no user Location is used and the patch field should start at 0.

## Repro (CONFIRMED, CPU-only)
- ToT master b3d4e7ad4 (build/Debug) and the v2026.21 release: hull color = Loc 1 + Patch, domain color = Loc 0 + Patch.
- v2026.20 release: both Loc 0, no Patch. `slangc` exits 0 every time. spirv-val passes each stage alone; it does not check HS↔DS.
- Regression bracket: #13078 is in v2026.21 and not in v2026.20. It is the only change in that range to the code that
  produces the hull Location (`constantOutputBase`, added by #13078). Release binaries + code trace; no commit-level rebuild.
- Scratch files: /workspace/agent/scratch-14334/ (also scratch-14334-shaders.tgz): repro, v/v2 + v/v3 variants, DXC dumps.

## Root cause (fact, file:line at b3d4e7ad4, source/slang/slang-ir-glsl-legalize.cpp)
1. `createVarLayoutForLegalizedGlobalParam` :1049 runs `usedBindingIndex[kind].add(bindingIndex)` for EVERY legalized leaf,
   system values included. `createGLSLGlobalVaryings` :2377 defaults `bindingIndex = 0` when the layout has no offset for
   the kind, and SV_* layouts use no varying slots (slang-parameter-binding.cpp:2081-2091). So `gl_Position` reserves slot 0.
2. `invokePatchConstantFuncInHullShader` :1439-1440 (#13078) sets `constantOutputBase = usedBindingIndex[VaryingOutput].getLSBZero()`
   → 1. Before #13078 the user field fell through to the default 0, which matched the domain only by accident.
3. The domain side takes Locations from the front end: one VaryingInput counter in declaration order
   (`collectEntryPointParameters` slang-parameter-binding.cpp:3550, `SimpleScopeLayoutBuilder::endLayout` :3225). It never
   reads `usedBindingIndex`. Only the `Patch` decoration is added in the IR (:4463-4467).

## Wider picture (fact, from variants)
- Slang's rule is "hull: control-point (CP) outputs first, then patch constants; domain: declaration order". The two agree only when
  the domain declares `OutputPatch<CP,N>` before the patch-constant struct.
  - v/v3 (OutputPatch first): ToT hull n0 uv1 color2 extra3, domain n0 color2 extra3 → match.
  - v/v2 (PatchData first, the usual HLSL sample order): hull n0 uv1 color2 extra3, domain color0 extra1 n2 → mismatch on both
    the per-patch and the per-CP data. This was also broken in v2026.20 (hull patch fields were all at 0), so it is NOT part of this regression.
- All 11 tests from #13078 (tests/{spirv,glsl}/tessellation-patch-constant-*.slang, tests/spirv/hull-shader.slang) use a CP
  struct with 2 user Locations and put OutputPatch first. None has an SV-only CP output, so none catches this bug. No test checks hull == domain mechanically.
- Explicit `[[vk::location(5)]]` on the patch field: domain honours it (5), hull ignores it (1) → users have no workaround.
  This was also true in v2026.20 (hull 0). Follow-up, not this regression.
- `-emit-spirv-via-glsl` on the hull fails in glslang ("'return' : non-void function must return a value"). In v2026.20 it failed
  differently ("type must be an array"). This is a separate GLSL-path problem and out of scope.
- Latent: `getLSBZero()` returns the first free slot, not the max used slot + 1. If CP outputs leave a gap (explicit locations {0,2}), a patch span ≥2 can
  overlap a CP output. This is pre-existing in #13078, hypothesis only, not reproduced.

## Reference numbering
- DXC 1.8.2505 `-spirv` (DeclResultIdMapper.cpp `finalizeStageIOLocationsForASingleEntryPoint` L2428-2439 @ea34891):
  HS outputs and DS inputs share ONE counter, sorted alphabetically by semantic, so the result does not depend on order. V1: COLOR Loc 0 on both
  sides. V2/V3: COLOR 0, EXTRA 1, NORMAL 2, TEXCOORD0 3 on both sides.
- SPIRV-Tools validate_interfaces.cpp:613-631 gives Patch vars their own location set ("not suppose to be tied to the
  normal input/output Location").
- glslang linkValidate.cpp `checkLocationRange` picks its location set only by in/out. A patch and a per-vertex var at the same Location
  is a collision or type-collision error. So in GLSL, patch and per-vertex share one namespace.
- Conclusion: a shared, non-overlapping numbering is valid for every consumer. A separate per-patch space starting at 0 is
  valid for spirv-val only.

## Candidate approaches
### A: System values do not reserve Locations (RECOMMENDED)
- Where: slang-ir-glsl-legalize.cpp:1049 (`createVarLayoutForLegalizedGlobalParam`). Skip the `usedBindingIndex` add when
  `systemValueInfo` is set, or more strictly, only record indices that came from a real layout offset.
- Delta: the repro gives hull color 0 on both targets, the same as the domain. v2/v3 and all 11 existing tests are unchanged, because their CP
  structs already use slot 0 for a user field.
- Tradeoffs: one-line change at the producer of the bad bitmap. It keeps #13078's "CP first, then patch" rule.
- Risk: low. `usedBindingIndex` is read only at :1440, so no other consumer changes.
### B: A + canonical domain order (front end, Khronos targets only)
- Where: slang-parameter-binding.cpp `collectEntryPointParameters` / `SimpleScopeLayoutBuilder` (:3225/:3550). For the domain stage,
  allocate `HLSLPatchType` (OutputPatch) params before per-patch params.
- Delta: v2 order now matches too. Domain reflection Locations change for "patch-constant-first" signatures.
- Risk: medium. The change is visible in reflection. It breaks a Slang DS paired with a hand-written TCS that matched the old order. A maintainer should decide the convention
  (CP-first vs DXC-alphabetical).
### C: Separate per-patch Location space (hull base 0; domain per-patch counter)
- Valid for spirv-val, but glslang rejects overlapping patch/per-vertex Locations. This breaks `-target glsl` and differs from DXC. It also
  changes the CHECKs in all 11 tests. Rejected.
### D: DXC-compatible alphabetical ordering for HS outputs + DS inputs
- Order-independent and works with DXC-built stages, but renumbers every HS/DS shader, including CP outputs (front end
  + IR pass). Largest blast radius; needs a maintainer decision. Possible follow-up.

## Recommended path (solution brief)
- **Hypothesis:** system-value leaves (gl_Position) are recorded in `usedBindingIndex`, so #13078's `getLSBZero()` base skips
  slot 0. The domain never sees that bitmap.
- **Fix:** Approach A at slang-ir-glsl-legalize.cpp:1049. Leave the domain side as it is.
- **Repro:** `slangc repro.slang -entry hullMain -target spirv-asm -o h.spvasm; slangc repro.slang -entry domainMain -target spirv-asm -o d.spvasm; grep -E 'color.*(Location|Patch)' h.spvasm d.spvasm`
- **Accept when:** (1) the repro gives hull and domain color `Location 0` + `Patch` for spirv and glsl; (2) all 11 existing tessellation-patch-constant
  / hull-shader tests pass unchanged; (3) SLANG_RUN_SPIRV_VALIDATION=1 passes both stages; (4) a new tests/spirv + tests/glsl test
  compiles HULL and DOMAIN from one file with an SV_Position-only CP output (plus a CP struct with only SV fields) and CHECKs the same Location
  on both sides; (5) the result matches DXC for V1 (COLOR 0).
- **Out of scope:** the v2 declaration-order mismatch (B/D), ignored hull `vk::location`, `-emit-spirv-via-glsl` failure. Name them in the PR as follow-ups.

## Sources
- DeepWiki Q1: confirms one shared counter per direction and no separate per-patch namespace.
- DeepWiki Q2: says `createPatchConstantFuncResultTypeLayout` ignores `vk::location`. Verified empirically: the hull ignores it.
- #12726 (closed by #13078), #13427 (held; same function), PR #13078 review: a bot flagged "hull→domain location matching for multiple
  user semantics is not tested on the domain side".
