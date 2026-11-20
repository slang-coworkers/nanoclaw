---
type: triage
---
# Triage: shader-slang/slang#8479 — IntVal folding error causing incorrect type identity check
Date: 2026-11-18 | Category: bug | Severity: medium | Priority: P2 | Component: frontend (generics constant folding) | Duplicate: no

## What's broken
`struct Payload<uint32_t x=16> { struct Hit{}; Hit hits[x]; }` with `uniform Payload y;` — binding
`y.hits[0]` to a local `Payload.Hit h` emits E30019 "expected an expression of type
'Payload<16>.Hit', got 'Payload<16>.Hit'". The two types print identically but compare unequal.
Workarounds: `16u` (suffix matching the param type) or an explicit `Payload<16>`.

## Repro (REPRODUCED on master v2026.22-37-g4a1d62c5b, slangc rebuilt 2026-11-18)
Repro dir: /workspace/agent/repro-8479/ (repro.slang + variants)
Command: `build/Release/bin/slangc repro.slang -stage compute -entry test`
→ error[E30019] type mismatch ... expected 'Payload<16>.Hit', got 'Payload<16>.Hit'
Matrix (all verified): `int x=16` PASSES (literal `Int` == param type); `uint32_t x=16` FAILS
(original); `uint32_t x=16u` PASSES; explicit `Payload<16>` holder PASSES. Fails for both
HLSL and spirv-asm targets (front-end issue).

## Root cause (verified in code)
`ConstantIntVal` carries (Type, value) operands (slang-ast-val.h:159-167). Two default-arg
specialization sites produce IntVals with different Type operands:
- Implicit/default path: `CoerceToProperTypeImpl`'s GenericDeclRefType branch folds
  `valParam->initExpr` via `ExtractGenericArgVal` (slang-check-type.cpp:398) →
  `ExtractGenericArgInteger(exp, genericParamType=nullptr)` (:177-211) →
  `CheckIntegerConstantExpression` with `AnyInteger` — keeps the unsuffixed literal's own type →
  `ConstantIntVal(Int, 16)`. Same uncoerced fold in the solver's default-arg constraint:
  `getGenericParamDefaultArgVal` (slang-check-constraint.cpp:918-945, fold at :944).
- Explicit-arg path: `TryCheckGenericOverloadCandidateTypes` coerces the arg to
  `getType(valParamRef)` (slang-check-overload.cpp:579) then `ExtractGenericArgInteger(arg,
  paramType)` (:592); unification wraps mismatches in `TypeCastIntVal(paramType, val)`
  (slang-check-constraint.cpp:3805-3810) which folds to `ConstantIntVal(uint32_t, 16)`.
So the local var's `Payload.Hit` (param-typed, via the solver) vs `y.hits[0]`'s element type
(literal-typed, via the implicit fold) are `DeclRefType`s over unequal `ConstantIntVal`s.
`Val::equals` is resolve-then-pointer (slang-ast-base.h:434-437); `CIV(Int,16) != CIV(uint32_t,16)`.
The equality failure hits `_coerce`'s `toType->equals(fromType)` (slang-check-conversion.cpp:1848)
→ `Diagnostics::TypeMismatch` E30019 (:1505-1510). IntVal printing omits the Type operand, so
both sides print 'Payload<16>.Hit'.
Extra hazard: mangling `k16` ignores the IntVal type (slang-mangle.cpp:408-413, from digest) —
non-canonical IntVals are a link-collision risk.
Family: #14476 (integer-folding umbrella), #14595 (silent truncation, different symptom of the
same uint→int conversion; skiminki-nv already linked #8479 from #14595's body). Bot draft PR
#14601 (Fixes #14595) touches the adjacent fold — rebase if it lands first.

## Candidate approaches
### Approach A (recommended): coerce the default IntVal to the param's declared type at the fold sites
- Where: slang-check-type.cpp:398 (pass `getType(valParam)` through ExtractGenericArgVal /
  ExtractGenericArgInteger, which already supports a non-null param type via
  IntegerConstantExpressionCoercionType::SpecificType); slang-check-constraint.cpp:944 (same).
- Behaviour delta: every default-filling path yields one canonical param-typed
  `ConstantIntVal(uint32_t, 16)`; identity restored.
- Tradeoffs: producer-side canonicalization ("one canonical representation per value" invariant);
  small blast radius (two fold sites); matches what the explicit-arg path already produces.
- Risk: low — ensure the coercion does not emit spurious diagnostics for legitimate defaults
  (e.g. `int x = 2147483648u` should still be caught at the param decl, not double-diagnosed).
### Approach B: normalize at comparison (make Val::equals / IntVal equality ignore the Type operand)
- Where: slang-ast-base.h:434 / slang-ast-val.cpp.
- Behaviour delta: all IntVal comparisons type-blind.
- Tradeoffs: the Type operand is load-bearing (IR lowering distinguishes int/uint; #14595/#14601
  truncation checks rely on it) — this masks real mismatches. REJECTED.
- Risk: high — silent semantic drift.
### Approach C: consumer-side tolerance in _coerce (treat same-value different-type IntVals as equal)
- Where: slang-check-conversion.cpp:1848.
- Tradeoffs: band-aid at the diagnostic site; the diagnostic is not the bug. REJECTED.
- Risk: medium — leaves mangling/link hazards in place.

## Recommended path
Approach A. Acceptance criteria: the repro compiles clean for both HLSL and SPIR-V targets;
`int x=16` and `16u` variants keep passing; a new regression test covers implicit-default
specialization + nested-type readback (none exists today — generic-default-value-param.slang only
uses defaults as array sizes, which get canonicalized by ASTBuilder::getArrayType and mask this);
full test suite passes.

## Sources
- Local code exploration (subagent digest 2026-11-18; load-bearing file:line citations re-verified
  in-source by triager: ast-val.h:159, check-type.cpp:177-211/333-401, check-conversion.cpp:1848/1505,
  check-overload.cpp:575-595, check-constraint.cpp:918-945/3805-3810).
- DeepWiki Q&A: default-arg substitution path (CoerceToProperTypeImpl / getGenericAppDeclRef) —
  confirms ExtractGenericArgVal passes no expected type for defaults.
- Shared-wiki concept: slang-language-core-integer-constant-folding.md (un-narrowed front-end IntVals).
- Related: #14476 umbrella, #14595 (+ skiminki-nv's link note), bot draft PR #14601.
