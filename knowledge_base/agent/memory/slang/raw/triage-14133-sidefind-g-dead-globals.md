---
type: triage
title: "Side finding from #14133: -g leaves orphaned module-scope ctor calls after inlineGlobalConstantsForLegalization (not filed)"
tags: [debug-info, dce, readnone, global-constant, static-const, regression, not-filed]
---
# Side finding (from the #14133 fix): `-g` leaves dead `static const` element initializers at module scope
Date: 2026-11-01 | bug | **regression** (release-bisected) | P2 | IR (slang-ir-legalize-global-values.cpp + readNone inference) | NOT FILED — operator decides (parent msg 14)
Found by slang-fixer; parent reproduced on 6815ed82d5. Local only: no GitHub writes.

## Repro (TOT 6815ed82d Release; /tmp/t14133/g/)
```slang
struct S { float a, b; __init(float x, float y) { a = x; b = y; } }
static const S arr[2] = { S(0.0f, 0.0f), S(1.0f, 1.0f) };
[shader("compute")][numthreads(32, 1, 1)]
void k(uniform S* out, uint3 tid: SV_DispatchThreadID) { out[tid.x] = arr[tid.x & 1]; }
```
`slangc dbg.slang -target cuda -g` (any of -g/-g1/-g2/-g3; -O0 and -O3) → `__device__ static const S_0 _S1 = S_x24init_0(1.0f, 1.0f);` + `_S2` (unused).
Without -g: gone. Downstream (RWStructuredBuffer variant, -g):
- ptx (NVRTC 12.6): "dynamic initialization is not supported for a __device__ variable". shader-sharedlib (gcc 12.2): "'S_x24init_0' was not declared in this scope" (global emitted before the function).
- spirv via GLSL (glslang): "global const initializers must be constant". Metal `constant S_0 _S1 = S_x24init_0(..)` / WGSL `const _S1 : S_0 = S_x24init_0(..)`: invalid by spec (no local compiler — not run).
- DXIL (dxc): accepts (HLSL allows it; dead code only). SPIR-V direct: clean.
- Scope: only ctor calls that are OPERANDS of an aggregate (array elements, nested struct field `static const W w = { S(1,2), 3 }`). Single `static const S k = S(1,2)` and chains: clean. Unused static const: clean (never linked).
  Synthesized ctor (`{0,0}` init list): clean — #11555 suppresses debug info in synthesized `$init`, so it stays readNone.

## Producer (verified at TOT)
1. `inlineGlobalConstantsForLegalization` → `GlobalInstInliningContextGeneric::inlineGlobalValuesAndRemoveIfUnused` (slang-ir-legalize-global-values.cpp:9-49)
   clones `%arr = makeArray(%1, %2)` with its operand tree into the kernel, then deletes ONLY the root `%arr` (:45-48). Its comment
   (:29-33) says calls are "illegal for all targets" so "we delete the globals we've inlined… none of the descendants … will have any uses".
   The descendants `%1 = call S.$init(0,0)`, `%2 = call S.$init(1,1)` stay at module scope with zero uses (IR dump AFTER the pass).
2. Without -g, a later simplifyIR DCE removes them: `S.$init` is `[readNone]` (inferred), so the call has no side effects.
   With -g, `S.$init` never gets `[readNone]` (verified: dump shows readNone appears in "AFTER simplifyIR" only without -g):
   `ReadNoneFuncPropertyPropagationContext::propagate` (slang-ir-propagate-func-properties.cpp:~88-140) counts DebugVar/DebugValue/DebugScope
   via `mightHaveSideEffects` — deliberate, see its comment "We leave in-block debug instructions to the ordinary side-effect test because
   dead-code elimination has no separate rule for preserving the debug records associated with a removed call".
3. DCE `shouldInstBeLiveIfParentIsLive` (slang-ir-dce.cpp:495-515) keeps any inst with `mightHaveSideEffects` → the orphaned module-scope calls survive → emitted as global initializers.
- Parent's hypothesis ("debug-info uses keep the calls alive") is close but not exact: there are NO debug uses of %1/%2. Debug insts in the
  CALLEE body block readNone inference, so DCE treats the orphaned module-scope calls as side-effecting.

## Regression (release-level bisect)
- v2026.1.1 (2026-01-27): clean. v2026.1.2 (2026-02-04): 2 dead globals. Also present in v2026.3, 2026.13.1, 2026.20, TOT.
- 47 commits in v2026.1.1..v2026.1.2; the only one touching readNone inference is **#9860** e9cc1f671 (2026-02-03, "Don't eliminate
  debug info instructions", Fixes #9815 "Debug info for void function missing"; author saipraveenb25): removed the `isDebugInst` skip in
  propagate-func-properties. Mechanism matches (fact); commit-level bisect NOT run (hypothesis-strength: high).
- #13116 (c538debef, 2026-10-14) only rewrote the comment; the rule predates it.

## Dedup (timelines + cross-refs + keywords; subagent, read-only) — CLEAN, related only
- Timelines of #13107, #13115, #13109, #13108, #12635, #12688, #14133: no -g / debug-info / dead-global mention. #13115/#13109 reviews: none.
- RELATED: #9860 (merged; origin, above); #9815 (closed; the debug-info need #9860 served); #13249 / PR #13254 (closed/merged; another
  "-g changes codegen" bug, loop inversion); #12415 (open PR, adds IRDebugGlobalConstant — could add debug-only uses of these values);
  #11555 (merged; suppresses debug info in synthesized $init — why synthesized ctors are clean); #13107/#13115/#14133 (same global-constant path).
- UNRELATED: #12635/#12688, #13444, #8313/#8340, #13982 (-g orphan DebugSource in SPIR-V).

## Candidate approaches
### A (RECOMMENDED): finish the cleanup in the pass that orphans the descendants
- Where: slang-ir-legalize-global-values.cpp:45-48 (`inlineGlobalValuesAndRemoveIfUnused`).
- Delta: when a deleted inlined global's operands are module-scope insts that are not legal globals (`!isLegalGlobalInst`) and now have no
  uses, delete them too (worklist, transitively). This makes the pass do what its own comment (:29-33) already claims.
- Tradeoffs: local, target-independent, no change to readNone/DCE semantics or #9860's debug preservation in functions. Same file as
  #13115 (different function) → trivial rebase. Risk: low; only removes zero-use, illegal-at-global insts the pass itself cloned.
### B: DCE treats an unused module-scope IRCall as dead regardless of callee effects (slang-ir-dce.cpp:~512)
- Rationale: module scope has no execution order; static-const initializer calls are pure by the checker contract (#10925, slang-check-decl.cpp:3716).
- Tradeoff: broader (every DCE run); a special case on parent kind in a generic query. Covers other orphan producers too.
### C: producer marks static-const initializer calls `IgnoreSideEffects` in lowering (slang-lower-to-ir.cpp:~11484-11500, `lowerConstantDeclCommon`)
- Records the checker's purity verdict on the call; clones keep it. Tradeoff: must decorate every call in the init expression tree; changes
  DCE of those calls after they are moved into functions under -g (they become removable, which is fine — they are pure).
### D: revisit #9860 — skip debug insts in readNone inference and preserve debug records some other way. Rejected as the fix here:
  reopens #9815 and changes -g behavior in all functions; owner (saipraveenb25) decision. Mention it in the issue as the root origin.
### E: emitters skip unused module-scope insts. Rejected: consumer patch.
Recommended: A (+ assert after the pass that no illegal-global inst with zero uses remains at module scope, if cheap). B is the fallback if a
maintainer prefers a DCE-level invariant.

## Interaction with #14133 / #13115
- #14133 fix A leaves a module-scope `call` for arrays of [ForceInline] ctors; that goes through the same pass → under -g the fixer's #14133
  array test will show these orphans. Either test #14133 without -g, or land this fix first / together. Parent: do not fold into #14133 without operator decision.
- #13115: user-written ctors are not folded → same orphan path; synthesized ctors already clean (#11555). No conflict beyond same file.

## Draft issue text (NOT FILED)
Title: `-g` leaves unused global initializers that call a struct constructor (static const array of structs); CUDA, C++ and GLSL reject the output

Body:
With `-g`, a module-scope `static const` array (or struct) whose elements are built by a user-written constructor compiles to unused
global variables that call the constructor. CUDA (NVRTC), C++ and GLSL reject these globals. Without `-g` the output is correct.

```slang
struct S { float a, b; __init(float x, float y) { a = x; b = y; } }
static const S arr[2] = { S(0.0f, 0.0f), S(1.0f, 1.0f) };

[shader("compute")][numthreads(32, 1, 1)]
void k(uniform S* out, uint3 tid: SV_DispatchThreadID) { out[tid.x] = arr[tid.x & 1]; }
```

`slangc repro.slang -target cuda -g -line-directive-mode none -o repro.cu` gives, in addition to the correct in-kernel array:

```cuda
__device__ static const S_0 _S1 = S_x24init_0(1.0f, 1.0f);
__device__ static const S_0 _S2 = S_x24init_0(0.0f, 0.0f);
```

`_S1` and `_S2` are not used. Results with `-g` (any level, also `-O0`):
- `-target ptx`: NVRTC 12.6 error "dynamic initialization is not supported for a __device__ variable".
- `-target shader-sharedlib`: gcc error "'S_x24init_0' was not declared in this scope" (the global comes before the function).
- `-target spirv -emit-spirv-via-glsl`: glslang error "global const initializers must be constant".
- Metal (`constant S_0 _S1 = S_x24init_0(...)`) and WGSL (`const _S1 : S_0 = S_x24init_0(...)`) output has the same globals. Neither language accepts a call to a user function in these initializers.
- DXIL and direct SPIR-V compile.

The problem occurs only when a constructor call is an element of an array or a field of a struct initializer. `static const S k = S(1, 2);` is not affected. Constructors that Slang synthesizes for `{ ... }` initializers are not affected.

Regression: v2026.1.1 gives correct output; v2026.1.2 and later (including top of tree) do not.

Analysis:
- `inlineGlobalConstantsForLegalization` copies `arr` and its element calls into the kernel. It then deletes only `arr` (`inlineGlobalValuesAndRemoveIfUnused`, `source/slang/slang-ir-legalize-global-values.cpp`). The two `call S.$init` instructions stay at module scope with no uses.
- Without `-g`, `S.$init` is inferred `[readNone]`, so dead-code elimination removes the unused calls.
- With `-g`, the debug instructions in the constructor body prevent the `[readNone]` inference (`slang-ir-propagate-func-properties.cpp`, changed by #9860), so dead-code elimination keeps the calls, and the emitters print them as globals.

Suggested fix: when `inlineGlobalValuesAndRemoveIfUnused` deletes an inlined global, also delete the operands that are not legal at global scope and have no remaining uses. The comment in that function already says this is the intent.

Related: #9860, #13107, #14133.
<sub>🤖 Generated by an automated Slang coworker — may be inaccurate. A human maintainer should verify.</sub>
