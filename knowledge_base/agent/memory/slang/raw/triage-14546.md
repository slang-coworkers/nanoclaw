---
type: triage
title: "Triage: shader-slang/slang#14546 — Diagnostics: suggest mul() when * is used between a matrix and a vector"
---

# Triage: shader-slang/slang#14546 — Diagnostics: suggest `mul()` when `*` is used between a matrix and a vector
Date: 2026-11-17 | enhancement (diagnostics) | severity: low | priority: P2 normal | component: frontend (semantic checking / diagnostics)
Repro: CONFIRMED on top-of-tree (2a91af5b7, v2026.22-26). Duplicate: no (related: #8796 generic-hints framework, #13141 Metal mul order).

## What's requested
When `*` (or `*=`) fails overload resolution with a matrix operand and a fitting vector/matrix operand,
add a note "did you mean `mul(m, v)`?" (arg order per shapes). Optionally reduce the candidate-note
spam (21 notes, CoopVec/CoopMat/int8). Origin: Discord user request (#slang-discussion, 11-10).

## Repro (verified)
```
cat > repro.slang << 'X'
RWStructuredBuffer<float4> o;
[numthreads(1,1,1)] void main() { float4x4 m = float4x4(1); float4 v = float4(1,2,3,4); o[0] = m * v; }
X
slangc -target spirv -entry main -stage compute repro.slang
```
→ `error[E39999]: no overload for '*' applicable to arguments of type (matrix<float,4,4>, vector<float,4>)` + exactly 21 candidate notes (5 unique `operator*` candidates; cap is 10 candidates, dedup by DeclRef). No `mul` mention.

## Codebase digest (file:line pointers, verified at HEAD)
- E39999 def: `no-applicable-overload-for-name-with-args`, source/slang/slang-diagnostics.lua:4335-4340.
- Emit site: `SemanticsVisitor::ResolveInvoke`, source/slang/slang-check-overload.cpp:3727-3736 (multi-candidate branch); candidate-note loop :3750+ (cap 10, E40015 overflow).
- Structural precedent (the key one): E40026 `compound-assignment-binary-operator-applies` note, slang-diagnostics.lua:4422-4427, emitted in the SAME function right after E39999 at slang-check-overload.cpp:3740-3746 via probe helper `findBinaryOperatorForCompoundAssignment` (:3510-3571). Single-candidate path note emit: :4032-4043.
- Operand types at emit site: already-checked `expr->arguments[i]->type` (QualType). Matrix/vector tests: `as<MatrixExpressionType>` / `as<VectorExpressionType>` (slang-ast-type.h:802/:789) with `getRowCount()/getColumnCount()/getElementCount()` (IntVal). Ready shape extractor: `_getBuiltinCompositeTypeShape` (slang-check-expr.cpp:4685-4710).
- Element-wise legality: m*m same shape legal (core.meta.slang Lua-generated operator*, :3195-3319 — no m*v overload in default scope). GLSL scope already has algebraic m*v (glsl.meta.slang:233-252, gated `isGLSLOperatorScope()`, slang-check-impl.h:1084) → hint should be gated on !isGLSLOperatorScope.
- `mul` overloads (hlsl.meta.slang): m×v :14919, v×m :14838, m×m :15000 (+int/logical variants; float verified). v×v → dot :14809.
- `*=` flows through the same ResolveInvoke path (parser builds op= as InfixExpr calling `operator*=`; E40026 emit sites prove the note works there).
- Tests: tests/diagnostics/did-you-mean-identifier.slang (E30015 note CHECK style), overload-argument-type-mismatch-many.slang (candidate-cap style). Directive: `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):`.

## Candidate approaches
### Approach A: standalone note + shape-based gate in ResolveInvoke (RECOMMENDED)
- Where: new `standalone_note` in slang-diagnostics.lua next to E40026 (:4422); emit from a named helper (e.g. `maybeSuggestMatrixMulForOperator`) called at slang-check-overload.cpp:3736 and the single-candidate path :4032-4043.
- Behaviour delta: on failed `*`/`*=` with (matrix,vector) / (vector,matrix) / (matrix,matrix) operands of builtin element types whose shapes fit `mul` (m(R,C)×v fits iff len==C; v×m iff len==R; m1×m2 iff C1==R2), emit note "did you mean mul(m, v)?" with correct arg order. Gate: operator name is "*" or "*=", exactly 2 args, `!isGLSLOperatorScope()`, builtin element type (via `_getBuiltinCompositeTypeShape`). For `*=`: suggest `m = mul(m, x)` only when the mul result shape equals the LHS shape (m *= v can never fit; m *= m2 fits iff mul(m,m2) has m's shape).
- Tradeoffs: error-path only (zero cost on success path); exact clone of the E40026 mechanism; per-shape note text matches the user's spelling. Risk: shape math via IntVal (use IntVal::equals on constant vals) must avoid division-dependent cases — matrices with non-constant dims are rare and fail conservatively (skip the note). Optionally use a probe-style overload check of `mul` (like findBinaryOperatorForCompoundAssignment) instead of shape math to respect `[require(...)]` target gating — more robust, slightly more code.
- Risk: low. Tests: new tests/diagnostics/did-you-mean-mul.slang (DIAGNOSTIC_TEST), covering m*v, v*m, m*m, *= cases + negative same-shape m*m (must NOT suggest — it compiles) and GLSL-scope case (m*v compiles).

### Approach B: optional embedded note on the E39999 diagnostic definition
- Where: add a conditional note field to `no-applicable-overload-for-name-with-args` like E30015's suggestionLocation (slang-diagnostics.lua:1415-1423).
- Tradeoffs: E39999 is shared by ALL failed overload calls, so every emit site must pass the optional arg or a dummy; wider surface than a standalone note. Ruled out: E40026 standalone-note precedent is strictly less invasive and lives in the same function.

### Approach C: also reduce candidate notes (the issue's secondary ask)
- Where: candidate-note loop slang-check-overload.cpp:3750-3870 (cap 10, dedup by DeclRef, E40015 overflow).
- Tradeoffs: touches generic diagnostics behavior shared by ALL overload failures; recently tuned by #7857/#12969 with dedicated tests (overload-argument-type-mismatch*.slang). Any tightening (e.g. lower cap for 2-arg operators, or group CoopVec/CoopMat notes) risks regressions and is a behavior decision, not mechanical.
- Recommendation: DEFER C to maintainer choice / separate issue; ship A alone.

## Recommended path
Approach A. Minimal, error-path-only, mirrors the merged E40026 mechanism (#14246) in the same
function; wording "did you mean 'mul(m, v)'?" rendered from actual arg order. Accept when: repro test
(did-you-mean-mul.slang) CHECKs the note for m*v, v*m, m*m, and a `*=` case; negative tests prove no
note for same-shape m*m (compiles) and in GLSL scope; existing diagnostic tests pass unchanged.
Status: PARKED — feature request; awaiting maintainer direction (approve / adjust wording / split C).

## Sources
- Subagent digests (local checkout HEAD 2a91af5b7), 2026-11-17.
- DeepWiki: no overload-suggestion hook exists beyond E30015; standalone-note-after-error in
  ResolveInvoke confirmed as the right mechanism; candidate-note cap/dedup details confirmed.
- Related: #8796 (hints framework), #13141 (Metal mul order), PR #12969 and #7857 (candidate-note
  history), PR #14246 (E40026 op= note).
