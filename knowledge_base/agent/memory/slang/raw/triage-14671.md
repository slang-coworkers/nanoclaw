---
type: triage
title: "Triage: shader-slang/slang#14671 — Align texture sampling overloads with HLSL and target capabilities"
---

# Triage: shader-slang/slang#14671 — Align texture sampling overloads with HLSL and target capabilities
Date: 2026-11-20 | Category: bug (+ feature gap) | Severity: high | Priority: P2 | Component: frontend (core-module intrinsics) + target-emit

## What's broken / being requested
Slang's texture-sampling overload surface diverges from HLSL and from its own targets:
1. **Repro (verified on master 410071448, fresh build):** `testCube.SampleGrad(s, dir, gx, gy, minLod)` — valid HLSL (DXC emits `OpImageSampleExplicitLod … Grad|MinLod`) — Slang mis-selects the cube offset overload (implicit `float`→`vector<int,3>` conversion, E30081 warning) then fails E40012 "expected a compile-time constant".
2. **Silent invalid SPIR-V (verified):** cube `SampleLevel(s, d, lod, int2(1,1))` compiles exit-0 and emits `Lod|ConstOffset` on a cube image — forbidden (VUID). Same path for the "add a zero offset" clamp workaround: emits `Grad|ConstOffset|MinLod` with an *unconditional* `OpCapability MinLod` (no capability-system gating).
3. Clamp (MinLod) and residency-status forms are offset-gated everywhere; cube gets neither. Noncube `SampleBias`/`SampleCmp`/`SampleCmpBias`/`SampleCmpGrad` lack the HLSL `(offset, clamp)` form.
4. Two Slang-specific short status forms `SampleCmpGrad/Bias(s,loc,cv,grad/bias,offset,out uint status)` silently rebind the last arg: SPIR-V treats it as sparse status; HLSL emitter passes it through positionally into DXC's `clamp` slot (different semantics per target).
5. WGSL texel-offset shape check at hlsl.meta.slang:1404 is a tautology (`flavor != 2D || flavor != 3D`) — never rejects. No 3D-Dref shape check before `OpImage*Dref*`. `SampleCmpLevel` unguarded on the SPIR-V case emits for cube+offset (guard is GLSL-case-only).

## Repro
```bash
cat cube-grad.hlsl  # TextureCube + SampleGrad(sampler, dir, gx, gy, minLod)
slangc cube-grad.hlsl -lang hlsl -target spirv-asm -profile sm_6_6 -stage fragment -entry main -O0 -o out.spvasm
# expected after fix: compiles; Grad|MinLod, no ConstOffset; passes spirv-val
```
Repro dir kept at /workspace/agent/scratch/repro-14671/ (cube-grad.hlsl, cube-level-off.hlsl, cube-grad-clamp.hlsl).

## Codebase digest (file:line; HEAD = 410071448, numbers exact)
- Shape machinery: `_Texture<T,Shape,isArray,...>` hlsl.meta.slang:873; `__ShapeCube` :597-606 (`dimensions=3`, `planeDimensions=2` → int2 offsets, except SampleGrad :4099/:4164/:4213 uses `Shape.dimensions` → int3).
- Non-combined overloads (extension :2987): Sample :3002/:3149(offset)/:3214(offset,clamp)/:3262(+status); SampleBias :3297/:3365(offset)/:3428(offset,clamp,status — no offset-less clamp); SampleGrad :4030/:4099/:4164/:4213 (no bare clamp form → the E40012); SampleLevel :4244/:4394(offset)/:4458(+status); SampleCmp :3460/:3549/:3598; SampleCmpLevelZero :3515/:3629/:3661; SampleCmpLevel :3678/:3738/:3790; SampleCmpGrad :3819/:3848/:3878; SampleCmpBias :3909/:3959/:3999. Combined twins in extension :1421 (Sample :1527-1685, SampleBias :1718-1777, Cmp family :1806-2319, SampleLevel :2542-2677).
- Cube offset guard exists ONLY for SampleCmpGrad (:2168/:2169, :3851, :3881) and SampleCmpBias (:2280, :2321, :3961, :4001) — everything else silently emits.
- Short status forms: :3878 (CmpGrad), :3999 (CmpBias), combined :2196/:2319; HLSL cases are bare `__intrinsic_asm ".SampleCmpGrad"` :3887 / ".SampleCmpBias" :4008 → positional emission puts `status` in DXC's `clamp` slot.
- Capabilities: `spvMinLod` def slang-capabilities.capdef:785; `spvSparseResidency` :775-777; alias `GL_ARB_sparse_texture_clamp = _GL_ARB_sparse_texture_clamp | spvSparseResidency` :1268 — no spvMinLod, and nothing in meta.slang ever `[require]`s spvMinLod; `OpCapability MinLod` is injected unconditionally inside spirv_asm snippets (:1676, :1698, :2503, :3252, :4202). `__glsl_extension(...)` modifier is GLSL-emission-only, never a SPIR-V gate.
- SPIR-V lowering is declarative spirv_asm snippets (no kIROp_TextureSample* family); emitted by `emitSPIRVAsm` slang-emit-spirv.cpp:11679-11879; asm checking is grammar-only (slang-check-expr.cpp:10535-10769) — shape assumptions carried by `[__assumeValidResourceOperands]`.
- Tests: tests/hlsl-intrinsic/texture/texture-intrinsics.slang (cube SampleGrad :372; comment at :129 claims cube has no offset form but nothing enforces it); sample-cmp-bias-grad-no-ext.slang; partial-resident-texture.slang.

## Candidate approaches
### A: Core-module alignment (shape asserts + complete the overload table) — RECOMMENDED
- Where: hlsl.meta.slang (extension :2987 + combined :1421), per-target spirv_asm/asm bodies; WGSL helper :1399-1406.
- Behaviour delta: extend the existing `static_assert(!(Shape is __ShapeCube))` precedent to all cube/cube-array offset overloads (Sample/SampleBias/SampleLevel/SampleGrad/Gather*); add the missing offset-free clamp/status forms per the issue's table (cube: `(C)`, `(C,S)`, status-only explicit-LOD; noncube `(O,C)` for SampleBias/SampleCmp/SampleCmpBias/SampleCmpGrad); fix WGSL tautology; diagnose 3D-Dref shapes.
- Tradeoffs: source break for Slang code using cube offsets (such code was already invalid on every real target — but verify CPU/interpreter behavior before asserting). A bare `float` clamp overload on noncube changes resolution of existing calls that implicitly convert float→offset (the issue names this) — likely needs the offset overload to stop accepting implicit float conversion, an overload-resolution change requiring the full test matrix.
- Risk: overload-resolution shifts silently re-selecting overloads for existing calls — must be covered by tests, not just new-form tests.
### B: Diagnose at emission only (keep declarations; validate shape/operand combos in the checker/IR)
- Where: `visitSPIRVAsmExpr` shape validation (slang-check-expr.cpp:10535+) or a legalization pass.
- Behaviour delta: invalid combos become clear diagnostics; valid HLSL still rejected (clamp forms still missing); no API completion.
- Tradeoffs: small diff, but fails the issue's primary ask (align the API, not just the errors).
- Risk: low; does not satisfy acceptance.
### C: Full alignment program (A + capability overhaul: spvMinLod gating per form, GL_ARB_sparse_texture_clamp alias split, SM 6.7/6.8 DXIL version gates, programmable offsets)
- Tradeoffs: complete; sweeping multi-PR scope. The issue itself defers programmable offsets to follow-up ("separate follow-up work").
- Risk: review burden; capability-atom changes are source breaks for bare-target callers (per shared-wiki capability-inference rules).

## Recommended path
Approach A, executed as phase 1 of C: (1) static_assert cube/cube-array on all offset overloads (+ Gather family — verify cube Gather offset forms too, per issue); (2) add missing clamp/status overloads per the issue's table, both plain and combined-sampler extensions; (3) wire real capability gates — clamp forms `[require]` the MinLod capability (add/fix `spvMinLod` alias usage; stop relying on unconditional `OpCapability MinLod` inside snippets), sparse-status forms gate `spvSparseResidency`; (4) fix WGSL tautology (:1404) and add 3D-Dref + cube-ConstOffset shape diagnostics; (5) test matrix per issue (1D/2D/3D/cube/array, positive+negative). Defer programmable offsets (issue's own direction). Flag for PR review (maintainer is the issue author): TextureCubeArray.SampleCmpGrad DXIL capability (SM 6.8 proposal excludes, DXC accepts — conservative: match the spec, note the discrepancy); migration plan for the two short status forms (conservative: keep accepting, fix so HLSL/DXIL output matches DXC's clamp interpretation OR error — do not leave targets diverging silently).

## Sources
- Local code research (two subagents): overload map + SPIR-V emission path digests, 2026-11-20, HEAD 410071448.
- DeepWiki: shape-restriction enforcement (static_assert idiom, WGSL tautology confirmed); capability idioms ([require] + static_assert, MinLod/SparseResidency snippet pattern).
- Verified repros: E40012 cube-grad; exit-0 `Lod|ConstOffset` cube-level-off; exit-0 `Grad|ConstOffset|MinLod` + unconditional `OpCapability MinLod` cube-grad-clamp (scratch/repro-14671).
- Related: #9210 (capability-system tracking, linked by issue), #12244 (closed — shadow-comparison capability atom naming, related prior work), #11997/#9777 (capability alias inference pitfalls relevant to any spvMinLod alias work).
