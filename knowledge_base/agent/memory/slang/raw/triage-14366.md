---
type: triage
title: "Triage: shader-slang/slang#14366 — vk::location on patch-constant field ignored by hull, struct-relative in domain"
description: Re-triage 2026-11-06 vs pdeayton-nv's absolute-Location decision; front-end rule is struct-relative in ALL stages → scope question asked; parked.
tags: [triage, spirv, glsl, tessellation, varying-layout]
---
# Triage: shader-slang/slang#14366 — `[[vk::location]]` on a patch-constant field is ignored by the hull and struct-relative in the domain
Date: 2026-11-06 | bug | medium | P2 | target-emit (SPIR-V/GLSL) + front-end varying layout | Duplicate: no (related #14376, #13892, #14334)

## Maintainer decision (verbatim, pdeayton-nv, https://github.com/shader-slang/slang/issues/14366#issuecomment-6691386811)
R1 "[[vk::location(N)]] should mean final interface Location N in both stages, independent of parameter order."
R2 "Conflicting explicit assignments should be diagnosed rather than silently rebased to avoid overlaps."
Open: whether R1 applies to explicit field Locations in every stage (the front end is struct-relative everywhere today) or only to patch-constant fields. Asked on the issue; parked until answered.

## Repro (master fef74e3c6, fresh Release build wt-14366; probes in /workspace/agent/scratch-14366)
`slangc repro.slang -entry hullMain -stage hull -target spirv-asm`; same for domainMain (PatchData first) / domainMain2 (OutputPatch first).
| | n | color |
|---|---|---|
| hull | 0 | 1 (ignored) |
| domain PatchData-first | 6 | 5 |
| domain OutputPatch-first | 0 | 6 |
Same numbers on `-target glsl`. Matches the issue table → `reproduced`.

## Other stages (the conflict) — vs2.slang / vs2.hlsl
`struct A { float4 a : AAA; }; struct B { [[vk::location(5)]] float4 b : BBB; [[vk::location(7)]] float4 c : CCC; };`
| shader | Slang master | DXC 1.8.2505 -spirv | glslang 16.6.0 (HLSL) |
|---|---|---|---|
| VS `vsMain(A a, B b, float4 d : DDD)` | a 0, b.b **6**, b.c **8**, d 9 | error: partial explicit stage input location assignment | a 0, b.b 5, b.c 7, d 1 |
| VS all explicit (a@0, B, d@9) | — | a 0, b.b 5, b.c 7, d 9 (either order) | same |
| VS `vsMain2(B b, A a, d)` | b.b 5, b.c 7, a 8, d 9 | — | — |
| FS `fsMain(float4 x, VOut v)` v.y@3 v.z@1 | x 0, v.y **4**, v.z **2** | — | — |
| two fields both @5 | (no diagnostic) | error: location #5 already consumed | accepted, both 5 |
| HS/DS repro (n implicit) | table above | error: partial explicit (both stages) | n 0, color 5 in hull and both domain orders |
| HS/DS all explicit (n@0) | — | n 0, color 5 in hull and both domain orders | same |
Whole-parameter `[[vk::location(5)]] B b` is already absolute in Slang (b.b 5, b.c 6; implicit a 0, d 1 gap-filled).

## Codebase digest (master fef74e3c6)
- Field attr → field's own VarLayout index: slang-parameter-binding.cpp:2276-2302 (`varResInfo->index = location`).
- Struct layout: implicit field = running count (:2851-2853); explicit field keeps index (struct-relative), struct size = max end (:2864-2867); explicit+implicit in one struct → E39023 (:2871-2877).
- Entry-point params: `SimpleScopeLayoutBuilder::endLayout` (:3165) pass 1 claims explicit *param* ranges, `UsedRanges::Add` return (overlap) ignored (:3199); pass 2 `Allocate` first free gap (:3225). A struct param with explicit fields is NOT explicit at param level → gets a sequential base.
- Final Location = param base + field offset: slang-ir-glsl-legalize.cpp:2308-2313 (also Metal/WGSL slang-ir-legalize-varying-params.cpp:3202-3209, :3536-3540).
- Hull: `createPatchConstantFuncResultTypeLayout` (glsl-legalize.cpp:1210) numbers user fields `offset = reservedCount` (:1246), reads only the semantic; base `usedBindingIndex...getLSBZero()` (:1439-1440). Patch-constant func is not an entry point → no front-end layout.
- `IRGLSLLocationDecoration` is emitted on field keys (slang-lower-to-ir.cpp:3249) but nothing reads it.
- No overlap/duplicate diagnostic for entry-point varyings. Dual-source blending (two fields @0 with vk::index 0/1) relies on that — a conflict check must key on (Location, index) like DXC.
- PR #14335 (head 87af7e3, non-draft): replaces the `getLSBZero` base with the hull result layout end (`getVaryingOutputLocationEnd`, PR :1308/:1456) + `translateGlobalVaryingVar` extent; field numbering unchanged (PR :1234). Touches the same hull function.

## Candidate approaches (all honour R1+R2 for patch fields; differ on scope)
### A: Absolute field Locations in the front end, all stages (one rule)
- Where: parameter-binding.cpp struct layout (:2789-2878) + endLayout (:3176-3200); hull: give the patch-constant result an explicit-aware layout (read the field's explicit Location; ideally from the front end per #13892's principle).
- Delta: a struct param/result with explicit fields is placed at base 0 with absolute field Locations; implicit params gap-fill around them; `Add` overlap → new error. VS/FS Locations change for shaders where such a struct is not first (b.b 6→5, v.y 4→3).
- Tradeoffs: matches DXC/glslang; one rule for Metal/WGSL/GLSL/SPIR-V; behaviour change for existing shaders (needs `pr: breaking change`?). Risk: reflection + users relying on current shifted numbers.
### B: Absolute only for tessellation patch-constant fields
- Where: hull createPatchConstantFuncResultTypeLayout (:1210) + domain param with HLSLPatchType/patch-constant role in endLayout.
- Delta: only HS/DS change. Tradeoffs: no change elsewhere; the attribute means two things depending on stage; special case in layout code. Risk: drift between the two rules.
### C: Diagnose-only (rejected): does not satisfy R1.

## Recommended path (pending the scope answer)
A if pdeayton-nv says "all stages", else B. Both: hull reads the explicit field Location as absolute; domain treats a struct with explicit fields as absolutely placed (base 0) and claims ONLY the explicit fields' ranges in endLayout pass 1 (claiming [0, struct size) would push OutputPatch to 6 again), then lets implicit params gap-fill; diagnose overlapping explicit ranges (key on Location+index). Repro: `slangc repro.slang -entry {hullMain|domainMain|domainMain2} -target spirv-asm` (+ `-target glsl`). Accept when: color = Location 5 + Patch in hull and both domain orders, n identical in hull and domain; two explicit assignments that overlap give an error; existing tessellation-patch-constant tests (incl. #14335's) still pass. Branching: wait for #14335 to merge and branch from master; if still open when direction lands, stack on fix/issue-14334 (owner sess-1793858928003-n4rvnv) and rebase after merge.

## Sources
- DeepWiki Q1 claimed field vk::location is absolute — WRONG, contradicted by the measured probes above. Q2: patch-constant layout is computed only in IR legalize; IRGLSLLocationDecoration unused (agrees with code).
- #13892 (tangent-vector principle: locations from front-end layout only), #14376 (implicit order mismatch), #14334/PR #14335, shared learning: glslang/DXC share one Location space for patch + per-vertex.
