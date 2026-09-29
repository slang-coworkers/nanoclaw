---
name: project_13306_global_uniform_as_temporary_hlsl_gec
description: "#13306 feature (tangent-vector, self-assigned): HLSL -Gec global uniforms writable as statics; triaged 09-29, no fixer; resource half blocked on draft PR #13116; gated daily re-check task recheck-slang-13306-e7c4"
metadata:
  node_type: memory
  type: project
---
**Chain state 2026-09-29:** triaged by slang-triager, comment 5882041497 (Main-verified: bot author, 2058 chars), Type=Feature. NO fixer (maintainer-owned design). Prereq: #13074 / draft PR #13116 (`legalizeResourceGlobalVars`, author's own); related #13137. Resume: new human comment (webhook) or #13116 leaves open — task `recheck-slang-13306-e7c4` (script `/workspace/agent/scripts/recheck-13306.sh`) wakes Main on the latter. Cancel task after handling.

Triager memo follows.

# Triage: shader-slang/slang#13306 — Allow global-scope uniform parameters to be used as temporaries in HLSL mode
Date: 2026-09-29 | feature-request | low | P3 | frontend (parser desugaring + checker + options; IR perf follow-up)
Author/assignee: tangent-vector (MEMBER, self-assigned, design sketched in body). Labels: Dev Opened. Type blank.
Checkout: master f3775b9a5 (== origin/master 2026-09-29). Debug slangc (version string stale 3649fb982).
Thread: gh-issue-shader-slang/slang-13306. Parent directive: read-only, NO fixer unless maintainer says go.

## What's requested
FXC/DXC `-Gec` (backwards-compat) lets code assign to a global uniform (`uint x;` or a legacy `cbuffer` member);
it behaves like a per-invocation `static` initialized from the parameter. Ask: same behavior in the HLSL dialect
behind a compat option. Author's sketch: parser desugaring — uniform gets synthesized name + `static` shadow;
for `cbuffer`, keep ONE ConstantBuffer and add a single `__transparent static` whole-struct copy (then scalarize in IR).

## Repro (GPU-free, scratch-13306/)
- a.hlsl `uint x; void set_x(uint v){x=v;}` and b.hlsl (same, `x` in `cbuffer MyCB`) → `error[E30011]: left of '=' is
  not an l-value` on hlsl and spirv targets. Confirms the gap (feature, so no `reproduced` label).
- c.hlsl = the manual desugaring (`cbuffer {uint __uniform_parameter_x;} static uint x = __uniform_parameter_x;`)
  compiles: HLSL emits `static uint x_0 = x_0_init();`, SPIR-V a Private var stored at entry. Workaround exists today.
- `__transparent` is not surface syntax (only `__transparent_block`), so the whole-CB shape can't be hand-written;
  simulated with an explicitly named static copy (f.hlsl/fd.hlsl).

## Codebase digest (file:line @ f3775b9a5)
- Write rejection: `getTypeForDeclRef` slang-check-decl.cpp:1675-1676 (`isGlobalShaderParameter` ⇒ isLValue=false);
  **TODO at :1666-1673 already proposes this exact feature** ("immutable parameter + global variable initialized from
  it") and names the blocker: globals with RESOURCE types in the back end. `isGlobalShaderParameter` :1582-1621.
  CB member path: constructDerefExpr slang-check-expr.cpp:696-699 (ConstantBuffer deref non-l-value), member
  access :587-593; E30011 emitted in checkAssignWithCheckedOperands :3824-3835 (lua :1351-1356).
- cbuffer desugaring: `ParseBufferBlockDecl` slang-parser.cpp:4131-4304. Already: struct `SLANG_ParameterGroup_<N>` +
  VarDecl typed `ConstantBuffer<...>` with a SYNTHESIZED name `SLANG_parameterGroup_<N>` (:4274; generateName adds SLANG_ :2496) and
  `ParameterGroupReflectionName` = user name (:4181-4183) ⇒ reflection/name-hint already decoupled from decl name
  (`getReflectionName` slang-check-shader.cpp:2808-2814; `getNameForNameHint` slang-lower-to-ir.cpp:1555-1566).
  TransparentModifier added :4279-4282; ImplicitParameterGroupVariableModifier :4284. `-no-mangle` branch :4262-4270.
  Callers :4329/:4332/:4337 (cbuffer/ConstantBuffer layouts), :4342 tbuffer, :4347 GLSL SSBO, :5989 GLSL block.
- Transparent lookup through a NON-buffer struct-typed var already works: :5989 calls ParseBufferBlockDecl with
  empty wrapper (GLSL `in Block {…};` → transparent var of struct type); verified g.glsl reads `color` through it.
  (DeepWiki claimed transparent lookup assumes a buffer deref — refuted by this path.)
- Parser already has both gates: `parser->getSourceLanguage()` (:124; HLSL checks e.g. :1383) and per-request
  options (`options.enableEffectAnnotations` from translationUnit->compileRequest->optionSet, :10094-10095 —
  `-enable-effect-annotations` = existing legacy-HLSL-syntax option precedent, CompilerOptionName 56).
  No `-Gec`/compat option exists. Next free CompilerOptionName = 160 (append before CountOf; max today 159).
- static-init lowering: `lowerGlobalVarDecl` lower-to-ir.cpp:11937 (IRGlobalVar with init block :11999-12008);
  `moveGlobalVarInitializationToEntryPoints` slang-ir-explicit-global-init.cpp:245 stores init at top of EVERY entry
  point (SPIR-V/GLSL/WGSL/Metal/CPU/CUDA; slang-emit.cpp:2493/:2498/:2523); D3D skips it and emits
  `static T v = v_init();` (slang-emit-c-like.cpp:4971-5058). Functions reached only via library export never see init.
- Closest precedent for a writable shadow of an input: GLSL `in` globals — slang-ir-translate-global-varying-var.cpp:
  247-269 + `GlobalVariableShadowingGlobalParameterDecoration` (glsl-legalize :4367/:4456). Nothing for uniforms.
- No SROA pass in Slang IR (constructSSA only promotes locals, ssa.cpp:478-573; IRGlobalVar never promoted).
  Plain global uniforms are packed into `ConstantBuffer<GlobalParams>` by slang-ir-collect-global-uniforms.cpp.

## Measured cost of the whole-CB copy (SPIR-V, struct {float4 big[64]; uint y;})
- constant index: whole copy -O0 = 1 Private aggregate; -O2 (spirv-opt) scalarizes it away.
- dynamic index `copy.big[tid.y]`: even at -O2 there is a whole `OpLoad %_arr_v4float_int_64` (1 KiB) of the CB array;
  per-member shadow: 0 whole loads. Text targets (HLSL/Metal/CUDA/WGSL/GLSL) get `static S copy = cb;` verbatim and
  rely on the downstream compiler. ⇒ the IR follow-up the author anticipates is required, not optional, for large CBs.

## Candidate approaches
### A: parser desugaring (author's sketch), reusing existing machinery  [RECOMMENDED starting point]
- Where: ParseBufferBlockDecl (:4131) + the global var-decl path; gate on `getSourceLanguage()==HLSL` && new option.
- cbuffer: leave CB var as is (already synthesized name + reflection name), MOVE TransparentModifier from it to a new
  synthesized `static` VarDecl of the struct type with init `VarExpr(CB var)`. Bare `uint x;`: rename to synthesized
  name + attach ParameterGroupReflectionName{x} (both consumers already honor it for any VarDeclBase) + synthesized
  `static uint x = <param>`. Lookup via existing transparent/ordinary scoping; no checker change.
- Delta: writes allowed; reflection names/bindings unchanged; decision baked into the AST (serialized modules carry it).
- Tradeoffs: small parser change; synthesized names can leak into diagnostics/debug info; whole-CB copy needs IR work.
- Risk: medium (resource-typed members; library entry-point-less init; perf of whole copy).
### B: semantic/IR shadowing (author's "more complicated" alternative)
- Where: getTypeForDeclRef :1675 (l-value in compat mode) + ConstantBuffer deref/member l-value (:587-593/:696-699)
  + lowering creates IRGlobalParam + shadow IRGlobalVar and redirects uses (cf GLSL `in` shadow precedent).
- Tradeoffs: no AST renaming, precise per-member shadows, but touches checker l-value rules for CB derefs (a special
  case for ConstantBuffer) plus lowering; module serialization must carry the per-module decision.
- Risk: medium-high (more touch points; l-value special-casing is exactly what the refactor on #13073 is avoiding).
### C: IR follow-up (needed with A's whole-CB copy)
- Not SROA in general: a cheaper, targeted pass — for a compat-shadow global initialized from a CB, forward loads of
  fields that are never stored back to the CB, and keep only written fields as private scalars/sub-aggregates.
  Removes the whole-copy cost measured above. Could land after A.

## Recommended path
A (+C before/with enabling for large CBs). Decisions for the maintainer: option spelling (`-Gec` DXC alias vs
`-fhlsl-…` like #13073's `-fhlsl-methods-mutable-by-default`); scope (bare globals, cbuffer, tbuffer?, `ConstantBuffer<T>`
declared explicitly?); resource-typed members (skip/diagnose — the TODO's named blocker); whether synthesized names may
appear in diagnostics.

## Risks / checks for implementer
1. Reflection: keep param names/bindings byte-identical (reflection-json diff with/without flag).
2. Resource/opaque members in a cbuffer or bare resource globals: exclude from shadow or diagnose.
3. Init only runs from entry points: library/export targets (lib_6_x, precompiled modules, link-time) see
   uninitialized static in non-entry callers.
4. Per-TU gating (#12836 lesson): compat flag must not leak into imported .slang modules; parse-time desugar handles it.
5. `-no-mangle` branch, `-fvk-bind-globals`, GlobalParams packing, `$Globals` naming, `register`/`packoffset`.
6. Diagnostics should name `x`, not `__uniform_parameter_x`.

## Author follow-up cmt 5881907490 (01:30Z, no @bot): resource-typed params
Author: parser desugar is type-blind ⇒ `Texture2D t; void set_t(Texture2D o){t=o;}` becomes a static RESOURCE global;
feature "may have to wait" for better `static` resource-global support.
- MEASURED @ f3775b9a5 (scratch r1-r5,k): `static Texture2D t = tp;` (read-only, unconditional write, conditional write),
  `static RWStructuredBuffer`, and a `static` struct containing a Texture → ALL `E30076 global variable cannot have
  opaque type` on hlsl/spirv/glsl/metal/wgsl/cuda. Front-end gate: checkVarDeclCommon slang-check-decl.cpp:3636-3647
  (added #6098, 2025-01). Suggested `static const` → E31226 (not const-foldable). So support today = none, not "weak".
- TRACKED: YES. #13074 "Support file-scope static resource variables when compiling HLSL" (OPEN, pdeayton-nv, assigned
  tangent-vector; requester says fully-mutable NOT required, assign-once suffices) → **draft PR #13116** (tangent-vector,
  OPEN draft, `Fixes #13074`, +9605/-1068, 91 files, updated 09-23): IR pass `legalizeResourceGlobalVars` lifts
  selected statics into entry-point locals + in/out/inout params, read-before-init diagnostic. Plus **#13137** (OPEN,
  tangent-vector) "Separate IRGlobalVar storage from global initialization actions" = struct-with-resource init case.
- ⚠ SCOPE GAP (load-bearing): #13116 admits only single resource values / homogeneous arrays; EXCLUDES parameter groups,
  combined texture-samplers, Append/Consume, acceleration structures, __DynamicResource, structs containing resources
  (PR body :65/:284). A type-blind desugar would synthesize statics of exactly those types from declarations that compile
  today (k.hlsl: `cbuffer {Texture2D t; float4 scale;}`, `RaytracingAccelerationStructure scene;`,
  `ConstantBuffer<float4> cbv;` all rc=0 now) ⇒ with the flag on, READ-ONLY code would regress even after #13116 lands.
- Mitigations (either decouples the plain-data part from #13116): (1) checker-side type split — parser always makes the
  pair but marks the shadow; checker (knows types; E30076 site) keeps opaque/unsupported-typed params as plain params
  (writes still E30011); (2) IR forwarding — before resource legalization, a shadow never stored after init has its loads
  replaced by the parameter (also fixes whole-CB copy cost); relax E30076 only for synthesized shadows, diagnose only
  written unsupported ones. (1) = smallest; (2) also gives perf.

## Dedup / related
Not a dup (searches: Gec, assign uniform l-value, cbuffer assign, writable uniform, backwards compatibility).
Related HLSL-compat opt-ins by the same maintainer: #13073 (methods mutable by default; option-naming + HLSL-dialect
gating direction; PRs #13213/#13232), #13076 (closed; HLSL-dialect-only ruling), #12836 (merged; per-TU source language).

## Sources
DeepWiki x2 (cbuffer transparent desugaring — partly refuted; static-init lowering per target). 2 code agents + direct
reads above. Recall: learning 1789420295853 (HLSL-compat features gate to HLSL dialect).

## DONE (2026-09-29 ~01:45Z)
- Posted triage 5-bullet **cmt 5882041497** (FRESH — author commented last; codex OUTPUT_REVIEW REJECT→APPROVE_WITH_EDITS→APPROVE,
  3 rounds; verified nv-slang-bot[bot], 2058 chars, 0 escape, 0 @, disclaimer, #13074/#13116/#13137/E30076). idfile saved.
- Set Type=Feature (was blank). No labels added (feature; no `reproduced`). Human `Dev Opened` untouched.
- NO fixer dispatch (parent directive + self-assigned maintainer design). Memo + [Triage] → parent.
- RESUME: fresh substantive human cmt on #13306 (esp. @nv-slang-bot ask for a design eval / prototype of (a)/(b)) →
  route up to parent. #13116 merge = re-assess the resource-typed half. Thread gh-issue-shader-slang/slang-13306.
