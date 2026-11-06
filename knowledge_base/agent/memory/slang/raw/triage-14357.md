---
type: triage
title: "Triage #14357 — bare Foo(...) on a defaulted generic struct fails (E39999)"
description: inferGenericArguments returns failure for non-callable generic inner decls; no default fallback and no constructor-driven inference of struct params. Parked for a language-design decision.
tags: [generics, overload-resolution, default-generic-args, constructors, language-design]
---
# Triage: shader-slang/slang#14357 — Consistency: generic defaults allow Foo declarations but reject bare Foo(...) constructor calls
Date: 2026-11-05 | enhancement (language-design; includes a diagnostic gap) | low | P3 | frontend (semantic check: overload resolution / generic inference)
Reporter: tdavidovicNV (MEMBER). Duplicate: no.

## What's broken / being requested
For `struct Foo<T = uint> { uint value; __init(){} __init(uint v){} }`, the type context `Foo foo;` uses the default
(`Foo<uint>`), but the expression `Foo(42u)` / `Foo()` / `(Foo)42u` fails with E39999 "could not specialize generic for
arguments of type (uint)". `Foo<>(42u)` works. Reporter asks for either default specialization in the call form or a
documented rule plus a clearer diagnostic; they leave the rule to maintainers.

## Repro (verified on master 4a6758601, Release build 2026-11-05 18:05; scripts in /workspace/agent/repro-14357/)
`slangc repro.slang -entry main -target hlsl -o repro.hlsl`. All 11 reporter rows reproduce exactly:
PASS `Foo foo;` `Foo<> foo;` `Foo<>(42u)` `Foo<uint>(42u)` `Foo<>()` `Foo foo = {42u};` `typealias Concrete = Foo; Concrete(42u)`
FAIL (E39999) `Foo(42u)` `Foo()` `Foo foo = Foo(42u);` `(Foo)42u`
Controls: `Inferred<T=float>{T value; __init(T v)}`: `Inferred(42u)` FAIL, `Inferred(1.0f)` FAIL (exact T match still fails),
`Inferred<>(42u)` PASS. `NoDef<T>{__init(T v)}`: `NoDef(42u)` FAIL. Generic ctor on plain struct `Plain(42u)` with
`__init<U:IInteger>` PASS. Generic *functions* with defaults: `f<T=uint>()` → `f()` PASS; `h<T=uint>(T x)` → `h(5.0f)` PASS (infers float).
Same failures on release 2026.13.1 → not a regression.

## Codebase digest (file:line @ 4a6758601)
- `slang-check-overload.cpp:3486` ResolveInvoke; callee is `TypeType(GenericDeclRefType)` (built `slang-check-decl.cpp:1835-1839`),
  not a DeclRefType, so the single-arg coercion fast path (L3540-3590) is skipped.
- Path: AddOverloadCandidates L3308 → AddDeclRefOverloadCandidates (GenericDecl branch L3235) → addOverloadCandidatesForCallToGeneric
  L3159 → inferGenericArguments L2912.
- **Root cause:** inferGenericArguments only handles `as<CallableDecl>(generic->inner)` (L2943); the `else` at L3038-3042
  (`// TODO(tfoley): any other cases needed here?  return DeclRef<Decl>();`) returns before trySolveGenericArguments (L3047),
  the only place defaults apply. No failure kind is recorded (kind None) → generic E39999 text (`slang-diagnostics.lua:4426-4431`,
  emitted in CompleteOverloadCandidate ~L1603-1611).
- Defaults in the solver (#10836, folded into the work-list solver by #11210): `slang-check-constraint.cpp` trySolveGenericArguments
  L3475, collectGenericMemberConstraints L1267-1280, solveDefaultGenericArg L1643 (default only when no non-default arg), solve()
  returns buildSubstDeclRef(inner) — nothing depends on inner being callable.
- After a solved `Foo<uint>`, AddDeclRefOverloadCandidates AggTypeDecl branch (L3230) → AddTypeOverloadCandidates L3072 →
  lookupConstructorsInType L3054 (`$init`). Ctors are only looked up on an already-specialized type → no constructor-driven
  inference of the enclosing struct's params exists anywhere.
- `Foo<>(…)`: visitGenericAppExpr slang-check-expr → TryCheckGenericOverloadCandidateTypes (overload L300; defaults L463-479).
- Type context: CoerceToProperTypeImpl `slang-check-type.cpp:333-444` fills defaults by hand.
- Cast: visitTypeCastExpr `slang-check-expr.cpp:7745`; CheckProperType yields `Foo<uint>` but L7766 stores the bare `typeExp.exp`
  as functionExpr → ResolveInvoke re-sees the bare generic → same failure.
- Tests: `tests/language-feature/generics/generic-default-type-param.slang`, `generic-default-value-param.slang` (only `Holder<>`
  spelling); `generic-function-default-param.slang`; `tests/diagnostics/generic-default-solver-blocked.slang` (E39999 with `()`).
  No test calls a generic struct by bare name.

## Two gaps
(a) no default fallback for a generic struct callee (explains Foo rows); (b) no inference of struct params from `__init` args
(explains Inferred/NoDef). Fixing (a) alone makes `Inferred(42u)` compile as `Inferred<float>` via uint→float conversion.

## Candidate approaches
### Approach A: default-only fallback
- Where: slang-check-overload.cpp:3038-3042 — for an AggTypeDecl inner decl, call trySolveGenericArguments with the empty context.
- Behaviour delta: Foo(42u)/Foo()/(Foo)42u → Foo<uint>; NoDef(42u) gets a focused OrdinaryGenericParamNotInferred diagnostic;
  Inferred(42u) → Inferred<float>(42u) (implicit conversion).
- Tradeoffs: ~10 lines; same rule as the type context `Foo foo;`.
- Risk: adding constructor inference later silently changes `Inferred(42u)` from Inferred<float> to Inferred<uint>.
### Approach B: constructor-driven inference + defaults as fallback (CTAD-like)
- Where: inferGenericArguments else-branch + a new path that enumerates `$init` on the unspecialized generic struct, unifies each
  ctor's param types (over the struct's params and the ctor's own generic params) against args, then solves with defaults.
- Behaviour delta: Foo(42u) → Foo<uint> (T unconstrained → default); Inferred(42u) → Inferred<uint>; NoDef(42u) → NoDef<uint>.
  Same rule as generic functions (h<T=uint>(T) with h(5.0f) → float).
- Tradeoffs: largest; nested generics (generic ctor in generic struct; the solver's fixpoint runs only on the outermost generic),
  ctors from extensions, ranking ctors that infer different T, `this`-typed/synthesized ctors, interaction with #13032.
- Risk: medium-high blast radius in overload resolution; needs spec text.
### Approach C: keep rejecting; focused diagnostic + docs
- Where: same else-branch records a new failure kind ("generic type 'Foo' must be specialized to be constructed; write Foo<>(…)");
  spec/user-guide note.
- Tradeoffs: smallest; no semantics change. Contradicts spec declarations.md:740-741 ("generic function/type … implicit
  specialization … from the context at the use site, as well as any default values"). Sub-question: `(Foo)42u` arguably is a type
  context and could keep CheckProperType's `Foo<uint>`.

## Recommended path
Blocked on a language-design decision (owner: csyonghe or another language maintainer). Questions:
Q1 accept bare `Foo(args)` at all? Q2 if yes, infer the struct's params from `__init` args with defaults only for
unconstrained params (B, matches generic functions), or defaults only (A, matches `Foo foo;`)? `Inferred<T=float>` +
`Inferred(42u)` is the case that separates them. Q3 does `(Foo)42u` follow the call rule or the type-context rule?
Engineering lean (not a verdict): B-with-defaults, because it matches generic-function inference and the spec text, and
shipping A first would silently change `Inferred(42u)` later. A is the cheap fallback if maintainers want defaults only; C
if they want rejection.
Repro: /workspace/agent/repro-14357/{r1..r11,c1..c10}.slang with `slangc X.slang -entry main -target hlsl -o X.hlsl`.
Acceptance (per chosen rule): all 11 rows + Inferred/NoDef controls behave as decided; new test under
tests/language-feature/generics/ (CPU COMPARE_COMPUTE) + a diagnostic test for rejected shapes (no kind-None E39999).

## Sources
- Spec @5f24f2e: specification/declarations.md:716 (defaults), :740-741 (implicit specialization covers types + defaults),
  :751-752 (expected type does not affect inference); generics.md:401-403 (error if a generic arg cannot be inferred).
  No proposal covers CTAD. docs/user-guide/06-interfaces-generics.md silent.
- #10836 MERGED (function-generic defaults in solver; author juliusikkala, reviewer csyonghe, merged by jkwak-work).
  #10538 CLOSED UNMERGED (test-only; never landed). #10546 MERGED (generic-default-type-param.slang). #11166 closed unmerged.
  #11656 (focused E39999 reasons, closes #11643). #13032 OPEN touches the solver (possible conflict). No duplicate; no open PR.
- DeepWiki (2 Qs) wrongly claimed ctor inference and cast-as-type-context work; contradicted by repro + source.
