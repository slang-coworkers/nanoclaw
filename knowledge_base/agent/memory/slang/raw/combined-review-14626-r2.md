---
type: source
description: "slang-reviewer R2 combined review of draft PR #14626 (#8479 IntVal-fold fix) @ a75397024, 2026-11-19: Reviewer A r2 verdict 0 bugs / 3 gaps / 3 clarity (test-coverage gaps: Box<> overload default-coercion + module-level API specialization coercion untested; dead ExtractGenericArgVal call contradicts the new canonicalization invariant; clarity: hand-rolled tryFoldImpl duplication, unanchored solver invariant claim, Int-typed recovery value). Devin clean (0/0/0/0). Verbatim memo; distilled into slang/8479-intval-fold-default-arg-type-identity.md."
okf_synth: exempt
---

# Combined PR Review — shader-slang/slang#14626 (pr) — ROUND 2, head a75397024

_Model deviation: open-weights group — Reviewers A and C ran on OpenCode/GLM-5.3 (group model policy). Reviewer A r2 verdict: 0 bugs, 3 gaps, 3 clarity. Reviewer B (Devin): clean — 0 vulnerabilities, 0 bugs, 0 flags, 0 informational (analysis up to date with a753970)._

## Reviewer A — Correctness (nv-slang-bot)

The judgment-call resolution is complete (outcomes recorded in the candidate file). All passes are done: 5 dispatched reviewers returned findings, and the clarity workflow produced 4 surviving candidates. Assembling the final review per REVIEW.md Steps 3–5 (Step 5 skipped — harness mode, no GitHub write).

**Editorial table (Step 3):**

| Source agent | file:line | Severity | Confidence | Evidence / verification quote | User-visible impact | Keep / Drop |
|---|---|---|---|---|---|---|
| test-coverage | slang-check-overload.cpp:561 | 🟡 Gap | 87 | `auto paramType = getType(m_astBuilder, valParamRef);` + tests contain no `Box<>` spelling | Overload-candidate default-coercion path regression undetectable | Keep |
| test-coverage + code-quality | slang-check-shader.cpp:3805 | 🟡 Gap | 90 / 75 (multi-subagent override) | `else if (intVal->getType() != paramDecl->getType())` | API/CLI specialization coercion untested | Keep (merged) |
| ir-correctness + clarity C004 | slang-check-type.cpp:253 | 🟡 Gap | 85 | `evaledArgs.add(ExtractGenericArgVal(argExpr, nullptr, nullptr));` (no callers) | Dead code contradicts new canonicalization invariant | Keep (merged) |
| clarity C001 (+code-quality F1, security obs., FG002/FG003) | slang-check-overload.cpp:561-580 | Clarity | High | hand-rolled `tryFoldImpl` + `getTypeCastIntVal` fallback blocks | Duplication of existing helper, unexplained case analysis | Keep |
| clarity C002 | slang-check-overload.cpp:541-549 | Clarity | Medium | "the constraint solver that re-folds defaults with their types only runs for outermost generics" | Load-bearing invariant claim unanchored | Keep |
| clarity C003 | slang-check-shader.cpp:3805 | Clarity | Medium | recovery `getIntVal(m_astBuilder->getIntType(), 0)` escapes the `else if` coercion | Recovery value keeps `Int` type, contradicting the new comment's invariant | Keep |
| doc-accuracy | slang-check-impl.h:2179 | 🔵 Question | 65 | "no value parameter in scope" phrasing | Defensible as written; deferral explained at consumption site | Drop (below floor; resolved in judgment pass) |
| clarity C006, FG004 | slang-check-impl.h / slang-check-type.cpp:213 | Clarity | Low | — | Literally-true phrasing; unreachable out-of-contract combo | Drop (judgment pass) |

---

```markdown
**Verdict**: 🟡 Has issues — 0 bug(s), 3 gap(s), plus 3 clarity comments

This PR threads the declared parameter type through every generic value-parameter default fold
(solver defaults, type-use-site defaults, nested-generic overload candidates, and API/CLI module
specialization args), so implicit defaults and explicit arguments reduce to the identical
param-typed `IntVal` — the representation-level fix #8479 requires. The representation change
itself is principled and was verified sound end-to-end; the findings are three untested/
dead-code residue sites and clarity debt in the two new hand-rolled coercion blocks.

<details>
<summary>Changes Overview</summary>

**Typed default folding — solver & type-use sites** (`slang-check-impl.h`, `slang-check-type.cpp`,
`slang-check-constraint.cpp`)
- `ExtractGenericArgVal` gains a mandatory `Type* genericParamType` argument; when non-null, the
  fold goes through `CheckIntegerConstantExpression`'s `SpecificType` coercion, so the resulting
  `IntVal` carries the parameter's declared type. The constraint solver's
  `getGenericParamDefaultArgVal` and `CoerceToProperTypeImpl`'s implicit-default fill now pass
  `valParam->getType()` instead of folding with the literal's own `Int` type.

**Nested-generic overload candidates** (`slang-check-overload.cpp`)
- When a non-callable nested generic application omits a defaulted value argument, the folded
  default is now coerced post-hoc to the parameter's declared type (the only default fold that
  survives for nested applications, since the solver only runs for outermost generics).

**API/CLI module specialization** (`slang-check-shader.cpp`)
- `_extractSpecializationArgs` still folds args untyped (param not yet identified), but
  `Module::_validateSpecializationArgsImpl` now coerces the folded value to the declared param
  type, so an API/CLI specialization records the same canonical value an in-source one produces.

**Tests** (`tests/language-feature/generics/generic-default-*`)
- Three new CPU-runnable tests: the #8479 repro (identical-printing `Payload<16>.Hit` types),
  the solver-fold unification, and the wrapping-coercion boundary (`uint16_t x = -1` → 65535).

</details>

<details>
<summary>Findings (6 total)</summary>

| Severity | Location | Finding |
|----------|----------|---------|
| 🟡 Gap | `source/slang/slang-check-overload.cpp:565` | Overload-candidate default coercion has no test (only the `<>` spelling reaches it) |
| 🟡 Gap | `source/slang/slang-check-shader.cpp:3805` | API/CLI specialization coercion is changed behavior with no test |
| 🟡 Gap | `source/slang/slang-check-type.cpp:253` | `InstantiateGenericType` (dead code) still extracts args without the param type |
| Clarity | `source/slang/slang-check-overload.cpp:561` | Hand-rolled fold duplicates `ASTBuilder::getTypeCastIntVal`; fallback case analysis unexplained |
| Clarity | `source/slang/slang-check-overload.cpp:545` | Solver-runs-only-for-outermost-generics claim is unanchored |
| Clarity | `source/slang/slang-check-shader.cpp:3805` | Error-recovery value escapes the new canonicalization the comment claims |

</details>

---

#### `source/slang/slang-check-overload.cpp:565`

🟡 **Gap**: No test reaches the new overload-candidate default coercion — the `Box<>` spelling is the only route

The new coercion in `TryCheckGenericOverloadCandidateTypes` only executes for a `GenericAppExpr`
whose inner decl is *not* a `CallableDecl` (`allowPartialGenericApp == false`) with defaulted
trailing args omitted — i.e. the `X<>` empty-angle-bracket spelling on a struct/typealias. None
of the three new tests uses that spelling: `generic-default-solver-fold-8479.slang` uses
`Box<16>` (unchanged explicit-arg branch) and bare `makeBox()` (solver path), and the other two
tests use bare `Payload`/`A` (type-use-site path) and explicit spellings. So the exact type
divergence this PR fixes (`Box<>` recording an `Int`-typed 16 vs `Box<16>` recording a
`uint32_t`-typed one) would silently resurface through this route with all tests green.

**Suggestion**: add one line to
`tests/language-feature/generics/generic-default-solver-fold-8479.slang` next to the existing
`Box<16> x = makeBox();`:

```slang
Box<> x2 = makeBox();  // `<>` spelling: the overload-candidate path must fold the default
                       // to the param-typed canonical `IntVal`, unifying with the solver's form
```

If the coercion regresses, the `Int`-typed 16 fails to unify with the `uint32_t`-typed default
and the test errors loudly. (Secondary, unexercised branch in the same hunk: the
`getTypeCastIntVal` fallback for non-constant defaults — e.g. a default dependent on an earlier
parameter, `f<uint32_t A, uint16_t B = ...A>` — is also uncovered if that shape is valid input.)

#### `source/slang/slang-check-shader.cpp:3805`

🟡 **Gap**: The new API/CLI specialization coercion is a changed public behavior with no test

The `else if (intVal->getType() != paramDecl->getType())` branch changes what
`IComponentType::specialize()` records for a `GlobalGenericValueParamDecl` — the slangpy-style
route. This path is not reachable from any `.slang` test (`slang-test` never calls `specialize`;
`slangc` has no specialization-arg flag), and no unit test was added, so nothing in CI would
catch a regression in this branch — for exactly the API users issue #8479 came from. It is
locally testable without a GPU: `tools/slang-unit-test/unit-test-global-type-param-specialize.cpp`
and `unit-test-specialized-component-hash.cpp` already drive
load-module → `specialize(...)` → link → compile end-to-end on CPU-only sessions.

**Suggestion**: add a `SLANG_UNIT_TEST` modeled on
`tools/slang-unit-test/unit-test-global-type-param-specialize.cpp`: a module with a global
generic value parameter of declared type `uint32_t` (so the type actually differs from the
unsuffixed literal's `Int` fold), specialized via
`SpecializationArg::fromExpr("16")`, asserting the specialized component links/compiles and that
its recorded arg compares equal to the in-source default form. Without the coercion, the API-folded
`Int`-typed arg diverges from the param-typed canonical value and the comparison fails.

#### `source/slang/slang-check-type.cpp:253`

🟡 **Gap**: `InstantiateGenericType` (dead code) still extracts every argument without the parameter type

This PR threads the declared param type through every live extraction site, but
`InstantiateGenericType` still passes `nullptr` for every argument:

```cpp
evaledArgs.add(ExtractGenericArgVal(argExpr, nullptr, nullptr));
```

so a `Box<16>` through this helper would record an `Int`-typed 16 where the patched paths record
a `uint32_t`-typed one — reintroducing the #8479 identical-printing-unequal divergence through
this route. A repo-wide search shows the function has no callers (only the declaration in
`slang-check-impl.h` and this definition), so there is no live bug today; the PR touched the
line only for the signature migration.

**Suggestion**: delete `InstantiateGenericType` per the repo's "delete dead code after a
refactor" rule, or thread the parameter types like every other call site if it is being kept
for future use.

#### `source/slang/slang-check-overload.cpp:561` (also `source/slang/slang-check-shader.cpp:3814`)

**Clarity**: The two new coercion blocks hand-roll `ASTBuilder::getTypeCastIntVal` internals

These blocks re-implement the unwrap-tryFold-wrap sequence that
`ASTBuilder::getTypeCastIntVal` (slang-ast-builder.h:456-472) already performs canonically, and
the existing precedent for this exact coercion is the two-line form in `TryUnifyIntParam`
(slang-check-constraint.cpp:3804-3809):

```cpp
if (val->getType() != paramDecl->getType())
{
    auto cast = m_astBuilder->getTypeCastIntVal(paramDecl->getType(), val);
    val = cast;
}
```

As written, the `else` branch is hard to trust: `TypeCastIntVal::tryFoldImpl` only folds a
`ConstantIntVal` base (slang-ast-val.cpp:2160), so the direct call fails both when `defaultVal`
is itself a `TypeCastIntVal` wrapping a constant — where the fallback succeeds only because
`getTypeCastIntVal` unwraps existing casts and re-folds the base — and when the default is
symbolic, where the fallback wraps it in a `TypeCastIntVal`. Nothing states those two cases, the
fold runs twice on the non-folding path, the `as<IntVal>(...)` wrappers around `getTypeCastIntVal`'s
result are dead defensiveness (it returns `IntVal*` unconditionally), and the `sink` passed to
`tryFoldImpl` in the shader.cpp copy is ignored (`SLANG_UNUSED(sink);`, slang-ast-val.cpp:2121).
Consider replacing both block bodies with the `TryUnifyIntParam` form, or extracting one
documented helper shared by all three sites so the fold lives in exactly one place.

Two smaller nits in the same blocks: the shader.cpp copy introduces a third builder spelling
(`auto astBuilder = getLinkage()->getASTBuilder()`) next to the recovery branch's
`m_astBuilder`/chained mix — if they are the same builder, pick one spelling for the block; and
the code assumes `defaultVal` is integer-valued (`TypeCastIntVal` semantically requires an
`IntVal` base) without an `SLANG_ASSERT(as<IntVal>(defaultVal))` or a comment stating that
invariant, per the repo's "fail loudly on out-of-contract input" convention.

#### `source/slang/slang-check-overload.cpp:545`

**Clarity**: The solver-runs-only-for-outermost-generics claim is load-bearing but unanchored

The comment's justification for doing the typed fold here — "the constraint solver that re-folds
defaults with their types only runs for outermost generics" — is accurate, but nothing in the
comment says where that gate lives. It is enforced by `genericIsOutermost` in
`TryCheckOverloadCandidateConstraints` (slang-check-overload.cpp:1176-1184), which gates the
`trySolveGenericArguments` call. Consider naming the gate so a maintainer who loosens that
condition can find every consumer of the invariant; if the solver ever runs for nested generics
too, this fold and the solver's `getGenericParamDefaultArgVal` fold must stay in sync.

#### `source/slang/slang-check-shader.cpp:3805`

**Clarity**: The error-recovery value escapes the canonicalization the new comment describes

The new coercion is an `else if`, so the recovery `0` substituted two lines above when `arg.val`
is not an `IntVal` keeps its `Int` type while the parameter may be declared `uint32_t` — the
exact type-divergence this PR eliminates, surviving in the recovery path, and the `expandedArg.argVal`
built from it compares unequal to the param-typed canonical form under `Val::equals`. Since a
diagnostic was already emitted this is recovery-only, but the new comment claims the
canonicalization unconditionally. Either a sentence saying why the recovery value deliberately
stays un-canonicalized, or moving the coercion below the `if`/`else if` so it also applies to
the recovery value, would make the stated invariant hold as described.

<sub>reviewed: a75397024b0fa63fd07a7ea992840e491a3abc3c · diff sha256 7e370b82323f</sub>
```

## Reviewer B — Devin Review

# Devin Review

_Commit status: **Analysis is up to date (a753970)**_

## AI Analysis

Generic value defaults now match the canonical values produced by explicit arguments. This prevents identical-looking specializations from comparing unequal.

Fold implicit defaults through the parameter’s declared type.
Canonicalize nested-generic defaults that bypass the outer constraint solver.
Coerce module API value arguments to the declared parameter type.
Add regressions for specialization equality, solver defaults, and unsigned conversion.

Summary An unsuffixed integer literal default for a generic value parameter folded with the literal's own Int type while explicit arguments yielded the param-typed form, so identical-printing Payload<16> spellings compared unequal (bogus E30019). Every default-fold site now records the param-typed canonical IntVal.

Root cause The default folds passed no expected type: implicit defaults (slang-check-type.cpp:396), the solver's default (slang-check-constraint.cpp:941), the overload-candidate default kept by nested generics (slang-check-overload.cpp:552), and module API value args (slang-check-shader.cpp:3805).

Tests tests/language-feature/generics/generic-default-*: repro (fails on master), solver-fold, coercion boundary. Suite 12371/12374; the 3 failures are pre-existing container CUDA fp8 PTX errors

Risk Low: defaults and API value args now coerce to the declared param type; the same form explicit arguments already produced.

Fixes #8479

Show less
Part 1 of 4
0/3
1
Fold defaults through the declared parameter type

ExtractGenericArgVal accepts the expected value-parameter type. Default evaluation supplies that type, while extraction without a parameter context passes nullptr.

slang-check-impl.h
source/slang
+14
−1
Viewed
All 1928 lines
5 lines
1929
public:
5 lines
All 239 lines
5 lines
2169
        ConstantFoldingCircularityInfo* circularityInfo = nullptr);
2170
    IntVal* ExtractGenericArgInteger(Expr* exp, Type* genericParamType);
2171
 
2172
    Val* ExtractGenericArgVal(Expr* exp, ConstantFoldingCircularityInfo* circularityInfo = nullptr);
2172
    // Extract the semantic value of a generic argument from an expression.
2173
    // `genericParamType` is the declared type of the value parameter the
2174
    // argument is filling; when non-null, an integer-valued expression is
2175
    // folded through that type, so the resulting `IntVal` carries the
2176
    // parameter's declared type rather than the expression's own type. This
2177
    // keeps an implicitly defaulted argument and an explicitly written
2178
    // argument of the same value equal under `Val::equals`, since both fold
2179
    // to the one canonical form. Callers extracting an argument with no value
2180
    // parameter in scope pass `nullptr`, leaving the fold to the expression's
2181
    // own type.
2182
    Val* ExtractGenericArgVal(
2183
        Expr* exp,
2184
        Type* genericParamType,
2185
        ConstantFoldingCircularityInfo* circularityInfo);
2186
 
2187
    // Construct a type representing the instantiation of
5 lines
All 2695 lines
slang-check-type.cpp
source/slang
+10
−3
Viewed
All 212 lines
5 lines
213
Val* SemanticsVisitor::ExtractGenericArgVal(
214
    Expr* exp,
215
    Type* genericParamType,
216
    ConstantFoldingCircularityInfo* circularityInfo)
217
{
218
    if (auto overloadedExpr = as<OverloadedExpr>(exp))
219
    {
220
        // assume that if it is overloaded, we want a type
221
        exp = resolveOverloadedExpr(overloadedExpr, LookupMask::type);
222
    }
223
    if (auto typeType = as<TypeType>(exp->type))
224
    {
225
        return typeType->getType();
226
    }
227
    else if (const auto errorType = as<ErrorType>(exp->type); errorType)
228
    {
229
        return exp->type.type;
230
    }
231
    else
232
    {
233
        if (!exp->type.type)
234
        {
235
            CheckExpr(exp);
236
        }
237
        return ExtractGenericArgInteger(
238
            exp,
238
            nullptr,
239
            genericParamType,
240
            ConstantFoldingKind::LinkTime,
241
            getSink(),
242
            circularityInfo);
243
    }
244
}
245
 
246
Type* SemanticsVisitor::InstantiateGenericType(
247
    DeclRef<GenericDecl> genericDeclRef,
248
    List<Expr*> const& args)
249
{
250
    List<Val*> evaledArgs;
251
 
252
    for (auto argExpr : args)
253
    {
253
        evaledArgs.add(ExtractGenericArgVal(argExpr));
254
        evaledArgs.add(ExtractGenericArgVal(argExpr, nullptr, nullptr));
255
    }
256
 
All 4 lines
261
 
5 lines
All 13 lines
5 lines
275
bool SemanticsVisitor::CoerceToProperTypeImpl(
276
    TypeExp const& typeExp,
277
    Type** outProperType,
278
    DiagnosticSink* diagSink)
279
{
5 lines
All 54 lines
5 lines
334
    if (auto genericDeclRefType = as<GenericDeclRefType>(type))
335
    {
5 lines
All 12 lines
5 lines
348
        for (Decl* member : genericDeclRef.getDecl()->getDirectMemberDecls())
349
        {
5 lines
All 18 lines
5 lines
368
            }
369
            else if (as<GenericTypePackParamDecl>(mem

## Vulnerabilities

(none reported)

## Bugs

(none reported)

## Flags

(none reported)

## Informational

(none reported)

## Reviewer C — Clarity

The full clarity pipeline is complete: high-level pass (4 candidates), fine-grained pass (11 entries incl. a coverage-audit note), coverage audit (all changed files/hunks covered), consolidation (6 FG merged/dropped into C-candidates), scope filter (all kept candidates are Direct), judgment-call resolution (all resolved via focused analysis, none left pending), and the Review Body written with agent attribution. Validation checks pass: unique IDs, no postable candidate left `Proposed`, all kept candidates carry scope/overlap metadata, locations map to PR-diff lines, proposed comments are strict blockquotes without process metadata, dropped candidates preserved for audit. Posting is left to the wrapping workflow as instructed.

Here is the complete canonical candidate file `tmp/review-candidates/pr-14626-clarity-workflow.md`:

````markdown
# Clarity Review Candidates — PR 14626 (canonical workflow file)

## PR Summary

**Title**: "check: fold generic value-param defaults to the declared param type"

The PR fixes issue #8479: an unsuffixed integer literal used as a generic value-parameter
default folded with the literal's own `Int` type, so `Payload<16>` spelled via the implicit
default and `Payload<16>` spelled explicitly produced two `IntVal`s that print identically
but compare unequal under `Val::equals` (bogus E30019). The fix threads the parameter's
declared type through every site that materializes a generic value argument: the implicit
default fold (`CoerceToProperTypeImpl`), the constraint solver's default
(`getGenericParamDefaultArgVal`), the nested-generic overload-candidate default
(`TryCheckGenericOverloadCandidateTypes`), and API/CLI-supplied module specialization args
(`Module::_validateSpecializationArgsImpl`). Three new regression tests under
`tests/language-feature/generics/` cover the repro, the solver path, and the unsigned-wrap
coercion boundary. The diff matches the stated approach and value proposition; the tests are
well-commented and each names the compiler path it pins.

One minor description/diff mismatch: the PR body lists `slang-check-shader.cpp:3805` among
the "default fold" sites, but that hunk canonicalizes *explicit* API-supplied value
arguments (folded earlier by `_extractSpecializationArgs` with no expected type); it is not
a default fold. The in-code comment at that site describes it correctly.

## Review Body

> GLM 5.3-authored clarity review:
>
> This is a small, well-motivated fix: generic value-parameter defaults now fold through the declared parameter type, so an implicitly defaulted `Payload<16>` and an explicitly written `Payload<16>` denote the same specialization (issue #8479). The approach is principled — every site that materializes a generic value argument should produce the one param-typed canonical `IntVal` — and the four sites are correctly identified. The three new tests are unusually well-commented; each states which compiler path it pins and the failure it guards against.
>
> Overall this feels close to merge-ready. The feedback below is about making the new invariant durable, not about the fix's correctness.
>
> ## Main Concerns
>
> 1. The two new coercion blocks (in `TryCheckGenericOverloadCandidateTypes` and `Module::_validateSpecializationArgsImpl`) re-implement, twice and inline, the fold-or-wrap policy that `ASTBuilder::getTypeCastIntVal` already encapsulates — including a dead `sink` argument and a no-op `as<IntVal>` wrap. Collapsing them onto the existing builder call (as `TryUnifyIntParam` already does) would give the canonicalization policy one source of truth.
> 2. The comment justifying the overload.cpp block asserts that the constraint solver "only runs for outermost generics" without a pointer to the code that enforces that, and that omitted-default branch has no dedicated regression test. Substantiating the invariant — ideally with a test — would protect the fix against future changes to solver invocation.
> 3. Smaller asks: why `InstantiateGenericType` and `_extractSpecializationArgs` still fold with no expected type (and why that is safe rather than a fifth instance of the bug), whether the error-recovery dummy in the shader.cpp chain deliberately escapes canonicalization, and a few low-priority naming/comment nits.

## Kept

### C001: Coerce-to-param-type logic is re-implemented inline at two sites that already have a canonical helper

- Status: Keep
- Confidence: High
- Scope: Direct
- Category: organization
- Location: `source/slang/slang-check-overload.cpp:561-577`
- GitHub link: https://github.com/shader-slang/slang/pull/14626/files

Context:

```cpp
auto paramType = getType(m_astBuilder, valParamRef);
if (defaultVal->getType() != paramType)
{
    if (auto folded = as<IntVal>(TypeCastIntVal::tryFoldImpl(
            m_astBuilder,
            paramType,
            defaultVal,
            nullptr)))
    {
        defaultVal = folded;
    }
    else
    {
        defaultVal =
            as<IntVal>(m_astBuilder->getTypeCastIntVal(paramType, defaultVal));
    }
}
```

Proposed comment:

> This block and its twin in `Module::_validateSpecializationArgsImpl` (slang-check-shader.cpp) both re-implement fold-then-wrap logic that already exists in one place: `ASTBuilder::getTypeCastIntVal` (slang-ast-builder.h:456) internally calls `TypeCastIntVal::tryFoldImpl` first and returns the folded `IntVal` when folding succeeds — so the explicit `tryFoldImpl` in the `if` branch re-does the first step of the `else` branch, and the whole block is equivalent to `defaultVal = m_astBuilder->getTypeCastIntVal(paramType, defaultVal);` (the builder path also handles strictly more inputs, because it unwraps pre-existing casts before folding). A one-line version of this same coercion, guarded by the same type-mismatch check, already exists at `TryUnifyIntParam` (slang-check-constraint.cpp:3804). Two details compound the redundancy: `as<IntVal>(...)` wraps `getTypeCastIntVal`'s already-`IntVal*` return (a no-op that reads like a null guard), and the shader.cpp copy passes a `sink` to `tryFoldImpl`, which ignores it (`SLANG_UNUSED(sink)` in slang-ast-val.cpp). Could the two new sites collapse onto the existing builder call (or a small shared, documented helper), so the fold policy has one source of truth?

- Scope decision: Direct
- Scope rationale: Both blocks are lines added by this PR.
- Overlap decision: Keep
- Overlap rationale: Retained candidate absorbing FG001, FG002, and FG010, which are line-level views of the same duplication; their extra details (builder subsumption, dead `sink`, no-op `as<IntVal>`) are folded into this comment.

Notes: This is the main structural finding. Verified that a plain `getTypeCastIntVal` call is behaviorally equivalent-or-better in every case the new code handles: the direct fold succeeds only for `ConstantIntVal` bases, which the builder helper folds anyway.

### C002: Load-bearing comment claim about the solver is asserted without a trace, example, or test

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-overload.cpp:539-548`
- GitHub link: https://github.com/shader-slang/slang/pull/14626/files

Context:

```cpp
// Otherwise, the generic decl had better provide a default value
// or this reference is ill-formed. The folded default is then
// canonicalized to the parameter's declared type — the same
// form an explicitly written argument produces — so the
// omitted argument records the one canonical `IntVal`. This
// is the only default fold left in play for a nested generic
// application: the constraint solver that re-folds defaults
// with their types only runs for outermost generics, so an
// untyped fold here would survive into the candidate's
// substitution.
```

Proposed comment:

> The last three lines carry the entire justification for why this site needs its own coercion instead of relying on the solver path fixed in slang-check-constraint.cpp, but they ask the reader to take two facts on trust: that the constraint solver "only runs for outermost generics", and that nothing later re-canonicalizes an untyped fold for the nested case. A maintainer who later changes when the solver runs has no pointer to what enforces this invariant. Could the comment name the code that keeps the solver away from nested applications, or show the user-code shape that reaches this `else` branch with an omitted value parameter? Relatedly, none of the three new tests appears to exercise this omitted-default branch (the value-param repro goes through `CoerceToProperTypeImpl`, and the solver-fold test through the constraint solver), so the new coercion block below has no test that fails without it — a regression test for this path would both pin the behavior and substantiate the comment.

- Scope decision: Direct
- Scope rationale: The comment lines and the coercion block they justify are both added by this PR.
- Overlap decision: Keep
- Overlap rationale: FG005 is the same concern at the same location; its proposed comment is merged into this one.

Notes: The claim is plausible (the solver's default handling is reached via partial application/call inference, not this direct decl-ref check), but currently unverifiable from the PR alone.

### C003: `InstantiateGenericType` still folds explicit args with no expected type, and the new `nullptr` is unexplained at the call site

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: decl-ref/substitution
- Location: `source/slang/slang-check-type.cpp:254`
- GitHub link: https://github.com/shader-slang/slang/pull/14626/files

Context:

```cpp
for (auto argExpr : args)
{
    evaledArgs.add(ExtractGenericArgVal(argExpr, nullptr, nullptr));
}
```

Proposed comment:

> With the new signature, `ExtractGenericArgVal`'s header comment says callers pass `nullptr` "with no value parameter in scope" — but `InstantiateGenericType` has the generic declaration (`genericDeclRef`) in scope, and its own header comment says the arguments "should already be checked against the declaration." So why is folding these explicit arguments with the expression's own type (rather than the corresponding parameter's declared type) the correct choice here? If the answer is that callers pre-coerce so the parameter type would be redundant, a sentence saying that would prevent a future reader from suspecting this is a fifth un-fixed instance of the bug the PR fixes. If instead this path can still fold an unsuffixed literal to its own `Int` type, that seems worth stating or fixing explicitly.

- Scope decision: Direct
- Scope rationale: The call line is changed by this PR (new signature, explicit `nullptr`s).
- Overlap decision: Keep
- Overlap rationale: FG006 is the same concern at this location and is merged into this comment; FG007 covers a different call site with a different justification and stays separate.

Notes: The asymmetry (default sites now type-directed, this explicit-arg site not) is visible but unexplained.

### C004: New `ExtractGenericArgVal` doc comment states the contract but omits the concrete example that motivates it

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-impl.h:2172-2186`
- GitHub link: https://github.com/shader-slang/slang/pull/14626/files

Context:

```cpp
// Extract the semantic value of a generic argument from an expression.
// `genericParamType` is the declared type of the value parameter the
// argument is filling; when non-null, an integer-valued expression is
// folded through that type, so the resulting `IntVal` carries the
// parameter's declared type rather than the expression's own type. This
// keeps an implicitly defaulted argument and an explicitly written
// argument of the same value equal under `Val::equals`, since both fold
// to the one canonical form. Callers extracting an argument with no value
// parameter in scope pass `nullptr`, leaving the fold to the expression's
// own type.
```

Proposed comment:

> This comment explains the mechanism well, but per the repo's comment conventions a non-trivial contract like this benefits from the concrete example it is actually about — e.g. `struct Payload<uint32_t x = 16>`, where the unsuffixed `16` would otherwise fold to an `Int`-typed constant that compares unequal to the `uint32_t`-typed constant an explicit `Payload<16>` produces (issue #8479). One or two lines with that example would let a reader verify the contract instead of reconstructing the failure from the abstract description. The rewritten `getGenericParamDefaultArgVal` comment in this same PR already carries such an example (`uint32_t N = 16`), so this is also a style-consistency ask.

- Scope decision: Direct
- Scope rationale: The doc comment is added by this PR.
- Overlap decision: Keep
- Overlap rationale: FG009 raises the same request at the same lines and is merged into this comment.

Notes: Low priority; the comment is already good, this asks for the motivating example the repo's style guide requests for non-trivial contracts.

### FG003: `else if` quietly exempts the error-recovery dummy from the new canonicalization

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: control flow
- Location: `source/slang/slang-check-shader.cpp:3805`
- GitHub link: https://github.com/shader-slang/slang/pull/14626/files

Context:

```cpp
IntVal* intVal = as<IntVal>(arg.val);
if (!intVal)
{
    sink->diagnose(Diagnostics::ExpectedValueOfTypeForSpecializationArg{...});
    intVal = getLinkage()->getASTBuilder()->getIntVal(m_astBuilder->getIntType(), 0);
}
else if (intVal->getType() != paramDecl->getType())
{
    // ... coerce to the declared type ...
}
```

Proposed comment:

> Because the new check is an `else if`, the error-recovery dummy `0` injected by the `!intVal` branch keeps its `Int` type and is recorded un-canonicalized in `expandedArg.argVal`. That may well be deliberate (a diagnostic has already been reported; canonical form is moot), but the comment just below explains only the success path, so a reader can't tell whether the exemption was considered or is an accident of chaining. One clause — e.g. that the error-recovery value deliberately keeps its own type — would settle it. If the exemption is not intended, using `if` instead of `else if` would canonicalize both paths.

- Scope decision: Direct
- Scope rationale: The `else if` line is added by this PR.
- Overlap decision: Keep
- Overlap rationale: Distinct control-flow point at a different anchor than C001, though in the same block.
- Judgment decision: Keep
- Judgment rationale: Verified against the diff that the `else if` really does skip coercion for the error dummy; error-path behavior is unchanged from before the PR, so this is a documentation-of-intent ask, not a bug claim.

Notes: Low confidence by design; behavior on the error path is unchanged from before the PR.

### FG004: New local `astBuilder` is a third spelling of the builder already reachable as `m_astBuilder` two lines above

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: naming
- Location: `source/slang/slang-check-shader.cpp:3813`
- GitHub link: https://github.com/shader-slang/slang/pull/14626/files

Context:

```cpp
intVal = getLinkage()->getASTBuilder()->getIntVal(m_astBuilder->getIntType(), 0);
...
auto astBuilder = getLinkage()->getASTBuilder();
```

Proposed comment:

> The new branch introduces `auto astBuilder = getLinkage()->getASTBuilder();` while the adjacent pre-existing error-recovery line reaches the same builder as `m_astBuilder` (and the enclosing function uses both spellings). Three spellings of one object in six lines invites the reader to wonder whether they differ. Could the new code use `m_astBuilder` like its neighbors — or, if the two builders can genuinely differ in this context, say so?

- Scope decision: Direct
- Scope rationale: The local declaration is added by this PR.
- Overlap decision: Keep
- Overlap rationale: Local naming consistency point, separate from C001's structural ask.

Notes: Minor consistency nit; kept per the fine-grained pass's coverage standard.

### FG007: `_extractSpecializationArgs` now passes two adjacent `nullptr`s encoding a cross-function contract

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: function contract
- Location: `source/slang/slang-check-shader.cpp:3866`
- GitHub link: https://github.com/shader-slang/slang/pull/14626/files

Context:

```cpp
SpecializationArg arg;
arg.val = semanticsVisitor.ExtractGenericArgVal(argExpr, nullptr, nullptr);
```

Proposed comment:

> With the new signature this call passes two adjacent `nullptr`s of different parameter types (expected fold type, then circularity info), and the reason the expected type is null — these API-supplied expressions are coerced to the parameter's declared type later, in `Module::_validateSpecializationArgsImpl` — is only apparent by reading that other function. The extraction/validation split looks deliberate (which parameter an argument fills isn't known until validation), but nothing at either end states the pairing. Could a short comment here, or a cross-reference from the validation-site comment, record that untyped extraction is compensated by typed validation, so the two sites don't drift apart independently?

- Scope decision: Direct
- Scope rationale: The call line is changed by this PR.
- Overlap decision: Keep
- Overlap rationale: Same "why `nullptr`" theme as C003 but a different call site with a distinct justification (deferred coercion vs. pre-checked arguments), so it stays a separate comment on its own diff line.
- Judgment decision: Keep
- Judgment rationale: Verified the coercion really does happen later in `Module::_validateSpecializationArgsImpl` (the hunk at slang-check-shader.cpp:3805), so the contract pairing described here is real; kept as a low-priority ask to state it.

Notes: Related to C003 conceptually; different site, different answer.

### FG008: Solver-fold test comment uses arrow shorthand for the mechanism instead of naming the pinned path

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `tests/language-feature/generics/generic-default-solver-fold-8479.slang:3-6`
- GitHub link: https://github.com/shader-slang/slang/pull/14626/files

Context:

```slang
// The constraint solver fills a generic function's defaulted value parameter
// when the call omits it (partial application → inference → default
// constraint). The solver-folded default and an explicitly written argument
// must denote the identical type, so the nested-type readback through the
// returned value unifies with the explicit spelling.
```

Proposed comment:

> The parenthetical "partial application → inference → default constraint" is compact but presumes the reader already knows the pipeline stages being named. Since this test exists precisely to pin the solver path (as opposed to the `CoerceToProperTypeImpl` path covered by generic-default-value-param-8479.slang), naming the actual mechanism whose behavior it pins — e.g. the solver's default-argument constraint collection in slang-check-constraint.cpp — would make the test's purpose verifiable rather than decorative, and would help whoever refactors that path find this test.

- Scope decision: Direct
- Scope rationale: The test file, including this comment, is added by this PR.
- Overlap decision: Keep
- Overlap rationale: Separate location and file from all other candidates.
- Judgment decision: Keep
- Judgment rationale: Follow-up analysis confirms the test's value hinges on distinguishing the solver path from the other default-fold sites, and the arrow shorthand is the only identification of that path; kept as a low-priority wording ask.

Notes: Pedantic by intent; the comment is directionally useful as written.

## Dropped

### FG001: `if (tryFoldImpl) ... else getTypeCastIntVal` restates the policy `getTypeCastIntVal` already implements

- Status: Drop
- Confidence: High
- Scope: Direct
- Category: control flow
- Location: `source/slang/slang-check-overload.cpp:562-577`

Context:

```cpp
if (defaultVal->getType() != paramType)
{
    if (auto folded = as<IntVal>(TypeCastIntVal::tryFoldImpl(...)))
    {
        defaultVal = folded;
    }
    else
    {
        defaultVal = as<IntVal>(m_astBuilder->getTypeCastIntVal(paramType, defaultVal));
    }
}
```

Proposed comment:

> (Merged into C001.)

- Overlap decision: Merged into C001
- Overlap rationale: Same concern and location as C001; its distinct detail (behavioral equivalence to a single `getTypeCastIntVal` call) is incorporated into C001's comment.
- Scope decision: Direct
- Scope rationale: New lines in this PR.

Notes: Retained here for auditability.

### FG002: Twin coercion block in `Module::_validateSpecializationArgsImpl` passes a `sink` that `tryFoldImpl` ignores

- Status: Drop
- Confidence: Medium
- Scope: Direct
- Category: function contract
- Location: `source/slang/slang-check-shader.cpp:3805-3827`

Context:

```cpp
if (auto folded = as<IntVal>(TypeCastIntVal::tryFoldImpl(
        astBuilder,
        paramDecl->getType(),
        intVal,
        sink)))
```

Proposed comment:

> (Merged into C001.)

- Overlap decision: Merged into C001
- Overlap rationale: The dead `sink` argument and the duplicated structure are both covered by C001's combined comment, which anchors on the overload.cpp twin and names the shader.cpp site.
- Scope decision: Direct
- Scope rationale: New lines in this PR.

Notes: Verified `TypeCastIntVal::tryFoldImpl` ignores its sink parameter (`SLANG_UNUSED(sink)`).

### FG005: Comment asserts "the constraint solver ... only runs for outermost generics" without pointer to the enforcing code

- Status: Drop
- Confidence: Medium
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-overload.cpp:543-548`

Context:

```cpp
// is the only default fold left in play for a nested generic
// application: the constraint solver that re-folds defaults
// with their types only runs for outermost generics, so an
// untyped fold here would survive into the candidate's
// substitution.
```

Proposed comment:

> (Merged into C002.)

- Overlap decision: Merged into C002
- Overlap rationale: Same concern at the same comment; C002's comment incorporates the "maintainer changing solver rules has no pointer" framing.
- Scope decision: Direct
- Scope rationale: Comment added by this PR.

### FG006: `ExtractGenericArgVal(argExpr, nullptr, nullptr)` in `InstantiateGenericType` — why is no expected type available here?

- Status: Drop
- Confidence: Medium
- Scope: Direct
- Category: type contract
- Location: `source/slang/slang-check-type.cpp:254`

Context:

```cpp
evaledArgs.add(ExtractGenericArgVal(argExpr, nullptr, nullptr));
```

Proposed comment:

> (Merged into C003.)

- Overlap decision: Merged into C003
- Overlap rationale: Same concern at the same line as C003.
- Scope decision: Direct
- Scope rationale: Line changed by this PR.

### FG009: Header doc for `ExtractGenericArgVal` would be stronger with the motivating example

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-impl.h:2172-2187`

Context:

```cpp
// keeps an implicitly defaulted argument and an explicitly written
// argument of the same value equal under `Val::equals`, since both fold
// to the one canonical form.
```

Proposed comment:

> (Merged into C004.)

- Overlap decision: Merged into C004
- Overlap rationale: Same request at the same lines as C004.
- Scope decision: Direct
- Scope rationale: Comment added by this PR.

### FG010: `as<IntVal>` wraps an expression whose static type is already `IntVal*`

- Status: Drop
- Confidence: Medium
- Scope: Direct
- Category: type contract
- Location: `source/slang/slang-check-overload.cpp:574-575`

Context:

```cpp
defaultVal = as<IntVal>(m_astBuilder->getTypeCastIntVal(paramType, defaultVal));
```

Proposed comment:

> (Merged into C001.)

- Overlap decision: Merged into C001
- Overlap rationale: The no-op `as<IntVal>` wrap is explicitly called out in C001's combined comment; separate posting would duplicate it at the same block.
- Scope decision: Direct
- Scope rationale: New lines in this PR.

Notes: The equivalent line in slang-check-shader.cpp is also covered by C001's comment.

### FG011: Coverage audit notes — regions inspected with no candidate

- Status: Drop
- Confidence: High
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-constraint.cpp:935-953`

Context:

```cpp
// `4`. The fold goes through the parameter's declared type, so an
// unsuffixed literal default (e.g. `uint32_t N = 16`) yields the same
// param-typed `IntVal` an explicitly written argument produces, and
// the two spellings of the specialization compare equal.
```

Proposed comment:

> (Not postable — audit-trail note only.)

- Overlap decision: Keep
- Overlap rationale: Overlaps no other candidate; it is an audit-trail note, not review feedback.
- Scope decision: Out-of-scope
- Scope rationale: Not feedback the PR author can act on; a coverage-audit record only, excluded from posting.

Notes: Regions audited as obviously clear with no candidate needed: the rewritten
`getGenericParamDefaultArgVal` comment and call (slang-check-constraint.cpp:935-953, includes
concrete example), the `CoerceToProperTypeImpl` comment and call
(slang-check-type.cpp:394-405), the `ExtractGenericArgVal` definition threading
`genericParamType` into `ExtractGenericArgInteger` (slang-check-type.cpp:213-242), and the
header comments of generic-default-value-coercion-boundary-8479.slang and
generic-default-value-param-8479.slang.
````

## Result (machine-readable)

```json
{"verdict":"APPROVE_WITH_NITS","bugs":0,"gaps":3,"questions":0,"diff_hash":"7e370b82323fe91df567739df8fe1da1ba42724ef96bca9ea7a2d3e15579a8b8","reviewers_complete":true,"note":"round 2, head a75397024; A's gap-1 'errors loudly' rationale refuted by reviewer-orchestrator revert drill (test is contract-pinning, not site-distinguishing)"}
```
