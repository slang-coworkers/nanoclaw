---
type: source
description: "slang-reviewer combined review of draft PR #14626 (IntVal-fold fix for #8479, folded default-arg type identity), 2026-11-19: REQUEST_CHANGES (1 bug / 3 gaps) adjudicated 03:05Z to APPROVE_WITH_NITS — the 🔴 bug (solver-path type mismatch) failed to reproduce on PR head and master and was downgraded to a consistency nit (thread the param type at slang-check-overload.cpp:544); nits = solver-path distinguishing test, coercion-boundary diagnostic test, optional module-level API specialization follow-up. Verbatim memo; distilled into slang/8479-intval-fold-default-arg-type-identity.md."
okf_synth: exempt
---

# Combined PR Review — shader-slang/slang#14626 (pr)

_Model deviation: open-weights group — Reviewers A and C ran on OpenCode/GLM-5.3 (group model policy), not claude-CLI/Opus. Reviewer A $0.00 recorded cost (opencode path)._

## Reviewer A — Correctness (nv-slang-bot)

All verification complete. Building the Step 3 editorial table — findings verified against source where each mechanism link was checked (untyped fold at `slang-check-overload.cpp:542-547`, typed explicit fold at `:592-594`, nested-generic solver skip at `:1208-1211`, `ConstantIntVal` type-operand identity at `slang-ast-val.h:167`, uncoerced module-level binding at `slang-check-shader.cpp:3795-3808`). All dispatched reviewers returned; security found nothing; clarity candidates C001–C004 survived consolidation, scope filtering, and judgment resolution.

**Editorial table (Keep rows only):**

| Source agent | file:line | Severity | Confidence | Evidence / verification quote | User-visible impact | Keep / Drop |
|---|---|---|---|---|---|---|
| code-quality | slang-check-overload.cpp:544 (anchor: slang-check-constraint.cpp:946) | 🔴 Bug | 85 | `auto defaultVal = tryConstantFoldExpr(valParamRef.substitute(m_astBuilder, valParamRef.getDecl()->initExpr), ConstantFoldingKind::CompileTime, &newCircularityInfo);` + Verification: `"a nested generic application keeps the linear pass for now"` (overload.cpp:1209-1210) and `ConstantIntVal(...) { setOperands(inType, inValue); }` (slang-ast-val.h:167) | Nested-generic defaults fold literal-typed → #8479's E30019 on identical-printing spellings survives this PR | Keep |
| ir-correctness + test-coverage | slang-check-shader.cpp:3843 | 🟡 Gap | 80 (+55 corroboration, multi-subagent) | diff: `arg.val = semanticsVisitor.ExtractGenericArgVal(argExpr, nullptr, nullptr);` + `expandedArg.argVal = intVal;` with no coercion to `paramDecl->getType()` (shader.cpp:3795-3808) | API/CLI-specialized `uint32_t` value params now diverge from typed defaults — same Val-identity divergence class | Keep |
| ir-correctness + test-coverage | slang-check-constraint.cpp:946 (anchor: test:26) | 🟡 Gap | 85 (+80, multi-subagent) | diff: `return visitor->ExtractGenericArgVal(valParam->initExpr, valParam->getType(), &newCircularityInfo);` — test exercises only the other site | Solver-path change untested; reverting it alone fails no test | Keep |
| code-quality + test-coverage | slang-check-type.cpp:239 | 🟡 Gap | 85 (+78, multi-subagent) | diff: `-            nullptr,` / `+            genericParamType,` (AnyInteger → SpecificType coercion) | Out-of-range/negative defaults now diagnose or wrap where master folded silently — boundary untested | Keep |
| code-quality Q (dead `InstantiateGenericType`) | slang-check-type.cpp:253 | — | — | — | — | Drop (folded into clarity C002 per Rule 5) |
| code-quality (undocumented param) | slang-check-impl.h:2172 | — | — | — | — | Drop (covered by clarity C001) |
| test-coverage Q (test comment) | test:8 | 🔵 | 70 < 90 | — | — | Drop from findings (survives as clarity C004, which bypasses the filter) |
| test-coverage Q (module specialization) | slang-check-shader.cpp:3843 | — | — | — | — | Drop (merged into Gap row 2) |
| security | — | — | — | — | — | No findings |

Final review follows:

---

**Verdict**: 🔴 Has issues — 1 bug, 3 gap(s), plus 4 clarity comments

The PR threads the declared generic value-parameter type into `ExtractGenericArgVal` so implicit defaults fold to the same `ConstantIntVal` (type operand included) as explicit arguments, fixing #8479's identical-printing-but-unequal types; the mechanism is principled (it mirrors the existing explicit-arg fold exactly, no new helpers). However, a third default-fold site in `TryCheckGenericOverloadCandidateTypes` still folds untyped and survives into final specializations for nested generics, and the module-level API specialization path now diverges from the typed defaults.

<details>
<summary>Changes Overview</summary>

**Generic value-param default folding** (`source/slang/slang-check-impl.h`, `source/slang/slang-check-type.cpp`, `source/slang/slang-check-constraint.cpp`, `source/slang/slang-check-shader.cpp`)
- What changed: `ExtractGenericArgVal` gains a `Type* genericParamType` parameter (the `circularityInfo = nullptr` default argument is removed). The two implicit-default fold sites — `CoerceToProperTypeImpl` and `getGenericParamDefaultArgVal` — now pass `valParam->getType()`, switching the fold from `AnyInteger` (literal's own type) to `SpecificType` (coerced to the declared parameter type). The other two call sites (`_extractSpecializationArgs`, `InstantiateGenericType`) pass `nullptr`, preserving the old untyped fold.

**Regression test** (`tests/language-feature/generics/generic-default-value-param-8479.slang`)
- What changed: new compute test (default/`-vk`/`-cpu` variants) verifying `Payload` (implicit default) and `Payload<16>` (explicit spelling) denote the same type; fails to compile on master in all three variants.

</details>

<details>
<summary>Findings (8 total)</summary>

| Severity | Location | Finding |
|----------|----------|---------|
| 🔴 Bug | `source/slang/slang-check-overload.cpp:544` (anchor: `source/slang/slang-check-constraint.cpp:946`) | Third default-fold site still folds without the declared param type; #8479 mismatch survives for nested generics |
| 🟡 Gap | `source/slang/slang-check-shader.cpp:3843` | Module-level generic value params specialized via API/CLI still fold to the literal's own type, now diverging from typed defaults |
| 🟡 Gap | `tests/language-feature/generics/generic-default-value-param-8479.slang:26` | No test covers the changed solver-path fold site (`getGenericParamDefaultArgVal`) |
| 🟡 Gap | `source/slang/slang-check-type.cpp:239` | New `SpecificType` coercion boundary (out-of-range/negative defaults) is untested |
| Clarity | `source/slang/slang-check-impl.h:2172` | New `genericParamType` parameter undocumented; canonical-form invariant unrecorded |
| Clarity | `source/slang/slang-check-type.cpp:253` | Remaining `nullptr` call sites carry no rationale; one lives in dead code |
| Clarity | `source/slang/slang-check-type.cpp:401` | Fold-site comments now understate the type-directed re-fold |
| Clarity | `tests/language-feature/generics/generic-default-value-param-8479.slang:8` | Test comments misattribute which statement fails on master |

</details>

---

**Inline comments:**

### `source/slang/slang-check-constraint.cpp:946`

🔴 **Bug**: Third default-fold site in `TryCheckGenericOverloadCandidateTypes` still folds defaults without the declared param type — the #8479 mismatch survives for nested generics

The PR fixes the two implicit-default fold sites that produce a literal-typed `ConstantIntVal`, but a third site folding `GenericValueParamDecl::initExpr` the same way is unchanged: when a generic is applied with fewer ordinary args than parameters, `TryCheckGenericOverloadCandidateTypes` folds the missing default via `tryConstantFoldExpr(valParamRef.substitute(m_astBuilder, valParamRef.getDecl()->initExpr), ConstantFoldingKind::CompileTime, &newCircularityInfo)` with no coercion to the declared parameter type (`slang-check-overload.cpp:542-547`). For outermost generics the constraint solver later replaces `candidate.subst` with typed folds through the `getGenericParamDefaultArgVal` site fixed here, but the solver is deliberately skipped for nested generic applications ("a nested generic application keeps the linear pass for now", `slang-check-overload.cpp:1208-1210`), so the untyped fold survives into the final decl-ref built from `candidate.subst`. Since `ConstantIntVal` stores its type as an operand (`ConstantIntVal(Type* inType, IntegerLiteralValue inValue) { setOperands(inType, inValue); }`, `slang-ast-val.h:167`) while `_toTextOverride` prints only the value, a default-filled nested spelling and an explicit spelling of the same instantiation are distinct `DeclRefType`s that print identically — the exact #8479 symptom surviving on this path.

**Example**:
```slang
struct Outer<T>
{
    struct Inner<U, uint32_t N = 16> { U a[N]; }
}

Outer<int>.Inner<float> x;       // N's default folds as ConstantIntVal(int, 16)   — linear pass
Outer<int>.Inner<float, 16> y;   // N explicit, folds as ConstantIntVal(uint32_t, 16)
y = x;                          // error 30019: expected 'Inner<float,16>', got 'Inner<float,16>'
```

**Suggested fix**:
```cpp
// slang-check-overload.cpp, TryCheckGenericOverloadCandidateTypes, default branch:
auto defaultVal = ExtractGenericArgVal(
    valParamRef.substitute(m_astBuilder, valParamRef.getDecl()->initExpr),
    getType(m_astBuilder, valParamRef),
    &newCircularityInfo);
```
The deeper alternative (which would have made this miss impossible): coerce each value-param default to its declared type once at declaration-check time in `visitGenericValueParamDecl`, so every fold site inherits a well-typed expression instead of each consumer remembering to pass the type.

### `source/slang/slang-check-shader.cpp:3843`

🟡 **Gap**: Module-level generic value params specialized via the API/CLI still fold to the literal's own type, now diverging from the typed defaults

`_extractSpecializationArgs` still folds specialization args with `nullptr` (pre-PR behavior), and the module-level validation in `_validateSpecializationArgsImpl` only checks that the arg is an `IntVal` — it never coerces it to `paramDecl->getType()` (`slang-check-shader.cpp:3795-3808`: `expandedArg.argVal = intVal;` binds the raw val verbatim, which flows into `emitBindGlobalGenericParam` at IR lowering). Before this PR that was consistent, because defaults also folded literal-typed; after this PR defaults fold param-typed, so specializing a module's `uint32_t` global generic value param with an unsuffixed `16` yields `ConstantIntVal(int,16)` while the same parameter's default and any in-source explicit spelling yield `ConstantIntVal(uint32_t,16)` — the same Val-identity divergence class as #8479, now between the API-specialization path and everything else. Entry-point args are unaffected: they are re-checked with per-parameter coercion through `CheckTerm` on a rebuilt `GenericAppExpr` in `EntryPoint::_validateSpecializationArgsImpl`.

**Suggestion**: in the `SpecializationParam::Flavor::GenericValue` case of `Module::_validateSpecializationArgsImpl`, coerce the extracted `IntVal` to `paramDecl->getType()` (mirroring what the entry-point path achieves via re-checking), and/or add a test that specializes a global generic value param via the API with an unsuffixed literal and unifies it against a default-spelled instantiation.

### `tests/language-feature/generics/generic-default-value-param-8479.slang:26`

🟡 **Gap**: The changed solver-path fold site (`getGenericParamDefaultArgVal`) has no distinguishing test coverage

The PR changes two fold sites, but this test only exercises `CoerceToProperTypeImpl` (type-position default specialization). The `getGenericParamDefaultArgVal` site — reached via `addDefaultGenericArgConstraint` whenever a generic *function* is called with a defaulted value parameter omitted — would silently regress if its change alone were reverted: nothing in the test fails. The only existing test reaching that path with a defaulted value param (`tests/experiments/algorithm/generic-int-controlled.slang`) uses `int` parameters, where the old untyped fold and the new typed fold coincide, so it cannot distinguish them either.

**Suggestion**: extend the test with a generic function with a non-`int` defaulted value param called with the default omitted, e.g.:
```slang
int f<let x : uint32_t = 16>()
{
    Payload<16> z;              // explicit spelling (SpecificType fold)
    z.hits[0].value = 2;
    Payload.Hit h2 = z.hits[0]; // implicit default must denote the same type
    return h2.value;
}
// in computeMain:
outputBuffer[0] = f();          // exercises addDefaultGenericArgConstraint
```

### `source/slang/slang-check-type.cpp:239`

🟡 **Gap**: The fold's coercion-mode change (`AnyInteger` → `SpecificType`) is untested at its edges — out-of-range and negative defaults

This line switches the default fold from `IntegerConstantExpressionCoercionType::AnyInteger` to `SpecificType` whenever a parameter type is passed, which coerces the default to the declared param type and range-checks it. That is a silent behavior change for defaults that don't cleanly fit the declared type: `struct Foo<uint32_t x = 5000000000>` or a negative default on an unsigned param previously folded silently with the literal's own type; it now goes through `coerce` and can emit an integer-constant-overflow diagnostic or wrap. The tightening is consistent with explicit args (which already pass `canCoerce` at `slang-check-overload.cpp:571`), but no test pins the new accept/reject boundary, so a future change to the coercion rules could shift it unnoticed.

**Suggestion**: add a diagnostic test (e.g. `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` with an out-of-range default such as `struct Bad<uint32_t x = 5000000000>`) asserting the intended diagnostic, and/or a CPU value test for a wrap-around default such as `struct Neg<uint32_t x = -1>` checking the folded value.

### `source/slang/slang-check-impl.h:2172`

**Clarity**: The new `genericParamType` parameter is undocumented, and the invariant it enforces is stated nowhere

The new parameter has no doc comment, and the invariant it enforces is not recorded anywhere in the changed code: an implicit default argument must fold to the *same* `ConstantIntVal` (type operand included) that an explicit argument would produce, so `Payload` (default) and `Payload<16>` (explicit) dedup to one `GenericAppDeclRef` — that identity is exactly what issue #8479 broke. Please state, either above this declaration or at the `genericParamType ? SpecificType : AnyInteger` switch in `ExtractGenericArgInteger` (`slang-check-type.cpp:186-188`), what the parameter is (the declared type of the generic value parameter the expression folds for), that a non-null type switches folding from "the literal's own type" to "coerced to the declared type" (matching what an explicit argument folds to), and that a null type means "no parameter context" (the pre-existing `AnyInteger` behavior). Right now a reader at either default-fold call site sees only that a type is forwarded; the fact that this changes the fold's coercion mode — and therefore which `ConstantIntVal` identity the result gets — is buried two calls down.

### `source/slang/slang-check-type.cpp:253`

**Clarity**: The remaining `nullptr` call sites carry no rationale, and one of them lives in dead code

After this PR, two call sites pass the declared parameter type and two pass `nullptr`, and nothing distinguishes them for a future reader. For `_extractSpecializationArgs` the `nullptr` preserves the old fold for preliminary values (entry-point args are re-checked downstream with per-parameter coercion — though note the module-level path is not, see the Gap comment on that line); a one-line comment (or named locals) at each `nullptr` site stating "no parameter context here" and why would prevent an over-eager future "fix". The call `ExtractGenericArgVal(argExpr, nullptr, nullptr)` also does not tell the reader which `nullptr` is the parameter type and which is the circularity guard. Separately, if you are open to it: `InstantiateGenericType` (`slang-check-type.cpp:245`) has no callers anywhere in the repo, so this PR currently threads a new argument through dead code, and the two-argument `ExtractGenericArgInteger` overload (`slang-check-type.cpp:203`) is likewise uncalled — deleting both here would avoid maintaining an untyped fold path that nothing exercises.

### `source/slang/slang-check-type.cpp:401`

**Clarity**: The fold-site comments now understate the type-directed re-fold

The comments at both value-param default-fold sites now understate what the code does. `getGenericParamDefaultArgVal` (`slang-check-constraint.cpp:935-944`) still describes only *that* the default is folded to an `IntVal`, and its `Foo<let N : int = 4>` example is the one case where old and new behavior coincide; this `CoerceToProperTypeImpl` site explains nothing about the re-fold (its only note is the pre-existing syntax-cloning TODO two lines up). The model a maintainer needs: a value-param default is re-folded from its raw `initExpr` syntax on each use (unlike type-param defaults, which are checked once at declaration and stored in `initType.type`), and with this PR that re-fold is type-directed — coerced to `valParam->getType()` so the result is identical to what an explicit argument would fold to. Please add one sentence capturing that at each site, or one canonical explanation on `ExtractGenericArgVal` that both sites can lean on, if you prefer a single source of truth.

### `tests/language-feature/generics/generic-default-value-param-8479.slang:8`

**Clarity**: The test comments misattribute which statement fails on master

The header comment and the inline "// The issue repro" comment (line 28) point at the wrong statement. On master, `y.hits[0]` and `Payload.Hit h` both fold through the same untyped default path, so that assignment passes; the statement that actually fails is `Payload.Hit h2 = z.hits[0];` — the one that mixes the explicit `Payload<16>` spelling (typed fold) with the implicit default (untyped fold). Please reword both comments to name `Payload<16>` vs `Payload` as the mismatched pair and to say which statement produced the quoted error, so a future contributor who "simplifies" the test trusting the comments does not drop the `z`/`h2` lines and silently lose the regression coverage. (The test as a whole still fails to compile on master in all three variants, so this is comment accuracy, not a coverage hole.)

---

<sub>reviewed: 6837bbbc051bc008c8f2ec82f16795eeffb71809 · diff sha256 395c139c5016</sub>

## Reviewer B — Devin Review

# Devin Review

_Commit status: **Analysis is up to date (6837bbb)**_

## AI Analysis

Generic value defaults now fold to their declared parameter type. Implicit and explicit spellings of one specialization therefore compare equally.

Add an expected type to ExtractGenericArgVal for coercion.
Pass each parameter's declared type at both default-folding sites.
Leave other argument extraction without an expected type.

Summary An unsuffixed integer literal default for a generic value parameter (uint32_t x = 16) folded to a ConstantIntVal with the literal's own Int type, while an explicit argument yielded the param-typed form, so two identical-printing Payload<16> spellings compared unequal (bogus E30019). Defaults now fold to the declared parameter type.

Root cause Both implicit-default fold sites passed no expected type: CoerceToProperTypeImpl (slang-check-type.cpp:396) and getGenericParamDefaultArgVal (slang-check-constraint.cpp:941). The fix threads valParam->getType() into ExtractGenericArgInteger's existing SpecificType coercion.

Tests tests/language-feature/generics/generic-default-value-param-8479.slang: implicit default and explicit Payload<16> unify; passes vk/cpu/llvm/cuda, fails on master. Suite: 0 failures.

Risk Low: only default-argument folding changes; explicit-argument and solver paths already produced the param-typed IntVal.

Fixes #8479

🤖 Generated by an automated coworker — may be inaccurate. A human maintainer should verify.

Show less
Part 1 of 2
0/4
1
Fold generic defaults using the declared parameter type

The expected type flows into the existing integer coercion. Only implicit-default folding supplies it; ordinary argument extraction remains unchanged.

slang-check-impl.h
source/slang
+4
−1
Viewed
All 2163 lines
5 lines
2164
    IntVal* ExtractGenericArgInteger(
2165
        Expr* exp,
2166
        Type* genericParamType,
2167
        ConstantFoldingKind kind,
2168
        DiagnosticSink* sink,
2169
        ConstantFoldingCircularityInfo* circularityInfo = nullptr);
2170
    IntVal* ExtractGenericArgInteger(Expr* exp, Type* genericParamType);
2171
 
2172
    Val* ExtractGenericArgVal(Expr* exp, ConstantFoldingCircularityInfo* circularityInfo = nullptr);
2172
    Val* ExtractGenericArgVal(
2173
        Expr* exp,
2174
        Type* genericParamType,
2175
        ConstantFoldingCircularityInfo* circularityInfo);
2176
 
2177
    // Construct a type representing the instantiation of
2178
    // the given generic declaration for the given arguments.
5 lines
All 2694 lines
slang-check-type.cpp
source/slang
+7
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
All 4 lines
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
All 4 lines
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
All 4 lines
260
}
5 lines
All 14 lines
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
All 68 lines
5 lines
348
        for (Decl* member : genericDeclRef.getDecl()->getDirectMemberDecls())
5 lines
All 31 lines
5 lines
380
            else if (auto valParam = as<GenericValueParamDecl>(member))
381
            {
5 lines
All 12 lines
5 lines
394
                if (outProperType)
395
                {
396
                    ConstantFoldingCircularityInfo newCircularityInfo(
397
                        makeDeclRef(valParam),
398
                        nullptr);
398
                    args.add(ExtractGenericArgVal(valParam->initExpr, &newCircularityInfo));
399
                    args.add(ExtractGenericArgVal(
400
                        valParam->initExpr,
401
                        valParam->getType(),
402
                        &newCircularityInfo));
403
                }
404
            }
405
        }
5 lines
All 63 lines
5 lines
469
}
5 lines
All 132 lines
Part 2 of 2
0/1
2
Cover implicit and explicit specialization equivalence

The regression reproduces a defaulted Payload type and compares it with an explicit Payload<16> specialization through nested-type access. The computed output verifies both fo

## Vulnerabilities

(none reported)

## Bugs

(none reported)

## Flags

Solver default typing lacks regression coverage
Investigate
generic-default-value-param-8479.slang:31-34

## Informational

(none reported)

## Reviewer C — Clarity

The pipeline is complete. All stages ran in order: high-level clarity candidates (C001–C005), fine-grained candidates (FG001–FG006), coverage audit (no gaps), consolidation (FG001 merged into C001, FG002 merged into C004), scope filtering (all postable candidates Direct), judgment-call resolution (C003/C005/FG003/FG004/FG005/FG006 resolved via focused analysis, all Keep), Review Body written, and mechanical validation performed against the posting script's checks. No posting actions were taken.

Complete contents of `tmp/review-candidates/pr-14626-clarity-workflow.md`:

# PR 14626 Clarity Review — Canonical Workflow Candidates

## PR Summary

The PR fixes issue #8479: an unsuffixed integer literal used as a generic value-parameter
default (`struct Payload<uint32_t x = 16>`) folded to a `ConstantIntVal` carrying the
literal's own `Int` type, while an explicitly-written argument folded to the parameter's
declared type. The two spellings of the same specialization then compared unequal, producing
a bogus E30019 (`expected an expression of type 'Payload<16>.Hit', got 'Payload<16>.Hit'`).
The fix threads the parameter's declared type (`valParam->getType()`) into
`ExtractGenericArgVal`, which forwards it to `ExtractGenericArgInteger`; a non-null expected
type makes `CheckIntegerConstantExpression` coerce the argument to that type before folding
(`IntegerConstantExpressionCoercionType::SpecificType`), so the folded value carries the
parameter type. The signature change also removes the `circularityInfo = nullptr` default,
so the two sites that fold *explicit* arguments (`_extractSpecializationArgs` and
`InstantiateGenericType`) now pass `nullptr, nullptr`. A focused regression test covers both
the implicit-default and the explicit spelling. The title, description, and diff agree, and
the change is small and well-motivated. The main clarity gaps: the new parameter has no
documented contract, the `nullptr` sites carry no justification for keeping the old folding
behavior, and the fold invariant (defaults fold to the declared type) is not stated at either
default-fold site.

## Review Body

> GLM-authored clarity review:
>
> This is a small, well-motivated fix that threads the generic value parameter's declared type into default-argument constant folding, with a regression test that exercises both the implicit and explicit spellings of the specialization. The mechanical change looks right and the PR description explains the root cause well; the code itself, however, does not yet carry that explanation, which is where my comments concentrate.
>
> ## Main Concerns
>
> - **The new `genericParamType` parameter has no documented contract** (slang-check-impl.h). A non-null type changes folding behavior in an important way (arguments coerce to the declared type, which is the actual bug fix), and `nullptr` silently keeps the old behavior. Right now a reader must reverse-engineer this from `ExtractGenericArgInteger`, and the removed default argument now forces every type-agnostic caller to spell out `nullptr, nullptr` with no local explanation.
> - **The `nullptr` at the two explicit-argument sites is unjustified in code** (slang-check-shader.cpp and `InstantiateGenericType` in slang-check-type.cpp). The justification ("explicit-argument and solver paths already produce the param-typed IntVal") lives only in the PR body. If that reasoning is right, one comment per site would make it durable; if it is not, the same type-tag mismatch could reappear through these paths.
> - **The fold invariant is not stated at either default-fold producer**. `getGenericParamDefaultArgVal`'s comment still describes the pre-fix behavior, and `CoerceToProperTypeImpl`'s fold site has no comment at all. The invariant — defaults fold to the parameter's declared type so implicit and explicit spellings compare equal — is the thing future regressions would break, so it should live at both producers.
> - **`InstantiateGenericType` appears to have no callers anywhere in the tree**, yet this PR updates a line inside it. Worth resolving its status (dead code to delete in a follow-up, or a caller I could not find), since it also bears on whether the `nullptr` question there matters.
>
> ## Overall
>
> Close to merge-ready: the change is correct in shape and the test is targeted. The asks here are documentation and invariant statements rather than restructuring — mostly asking that the reasoning already present in the PR description be moved into the code so it survives the PR. The test nits are minor (an expectation that depends on zero-initialized unbound uniform memory, and a comment sentence that garbles the failure mode) and can be handled in one small pass.

## Kept

### C001: `ExtractGenericArgVal`'s new `genericParamType` parameter has no documented contract

- Status: Keep
- Confidence: High
- Scope: Direct
- Category: API shape
- Location: `source/slang/slang-check-impl.h:2172-2175`
- GitHub link: https://github.com/shader-slang/slang/pull/14626/files
- Scope decision: Direct
- Scope rationale: The candidate targets the declaration lines the PR itself rewrote.
- Overlap decision: Keep
- Overlap rationale: Absorbed FG001's two-adjacent-`nullptr` readability concern into this single declaration-level contract request; no other candidate covers the declaration.

Context:

```cpp
Val* ExtractGenericArgVal(
    Expr* exp,
    Type* genericParamType,
    ConstantFoldingCircularityInfo* circularityInfo);
```

Proposed comment:

> The new `genericParamType` parameter is the load-bearing part of this fix, but neither this declaration nor any call site states its contract. A reviewer has to reverse-engineer from `ExtractGenericArgInteger` that a non-null type makes integer arguments fold to a `ConstantIntVal` carrying that type (so an implicit default `x = 16` for `uint32_t x` produces a `uint32_t`-typed value, identical to the explicit spelling), while `nullptr` keeps the argument's own type — i.e. the exact behavior this PR fixes. Please document here what the parameter means (the declared type of the generic value parameter the argument is being folded for), when `nullptr` is valid, and the invariant it establishes: implicit defaults and explicit arguments must fold to `Val`s that compare equal. Since the removed `circularityInfo` default now forces type-agnostic callers to spell out `nullptr, nullptr`, the same comment (or a small `ExtractGenericArgVal(Expr*)` overload) should make those call sites say what they mean.

Notes:
The removal of the `circularityInfo = nullptr` default is what surfaces the contract gap:
callers now write `ExtractGenericArgVal(e, nullptr, nullptr)` with no local explanation of
what either `nullptr` means. Merged FG001 (adjacent-nullptr readability / overload
suggestion) into this comment. Related: C002, C004.

### C002: The `nullptr, nullptr` explicit-argument call sites carry no justification for keeping the old folding behavior

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: invariant
- Location: `source/slang/slang-check-shader.cpp:3843`
- GitHub link: https://github.com/shader-slang/slang/pull/14626/files
- Scope decision: Direct
- Scope rationale: The comment anchors on the call line the PR rewrote to pass two explicit `nullptr`s.
- Overlap decision: Keep
- Overlap rationale: Distinct from C001 (declaration contract) and C003 (dead-code status); this candidate asks why `nullptr` is correct at the explicit-argument sites.

Context:

```cpp
SpecializationArg arg;
arg.val = semanticsVisitor.ExtractGenericArgVal(argExpr, nullptr, nullptr);
outArgs.add(arg);
```

Proposed comment:

> This change deliberately passes `nullptr` as the expected type at the explicit-argument fold sites (here and in `InstantiateGenericType` in slang-check-type.cpp), which keeps the old "fold with the argument's own type" behavior — exactly the behavior this PR identifies as the bug at the default-argument sites. The PR description asserts that explicit-argument and solver paths already produce the parameter-typed `IntVal` elsewhere, but that justification lives only in the PR body; a future maintainer touching these lines has no way to tell whether the `nullptr` is load-bearing or an oversight that reintroduces the type-tag mismatch. Please add a comment at each `nullptr, nullptr` site explaining why folding without an expected type is correct there (e.g. these arguments are coerced against the parameter type by a later validation step), or thread the parameter type in too if it is in fact available.

Notes:
Same question applies to `source/slang/slang-check-type.cpp:254`. If both sites share one
rationale, one comment at each site is enough; posted here so the diff line can carry it.
Related: C001, C003.

### C003: `InstantiateGenericType` appears to have no callers; the PR updates a line inside possibly-dead code

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: correctness smell
- Location: `source/slang/slang-check-type.cpp:254`
- GitHub link: https://github.com/shader-slang/slang/pull/14626/files
- Scope decision: Direct
- Scope rationale: The candidate anchors on the line the PR modified inside this function, and the reachability of that line is directly relevant to reviewing the modification.
- Overlap decision: Keep
- Overlap rationale: Same lines as C002 but a genuinely different problem (dead-code status versus justification of the `nullptr` argument).
- Judgment decision: Keep
- Judgment rationale: Focused analysis confirmed the concern: a workspace-wide search finds only the declaration in `slang-check-impl.h:2178` and this definition — no callers. Generic applications in source are checked through the solver/`CoerceToProperTypeImpl` path instead. The question is credible and reviewable on the changed line.

Context:

```cpp
Type* SemanticsVisitor::InstantiateGenericType(
    DeclRef<GenericDecl> genericDeclRef,
    List<Expr*> const& args)
{
    List<Val*> evaledArgs;

    for (auto argExpr : args)
    {
        evaledArgs.add(ExtractGenericArgVal(argExpr, nullptr, nullptr));
    }
```

Proposed comment:

> I can't find any caller of `InstantiateGenericType` in the tree — the only references I see are its declaration in `slang-check-impl.h` and this definition, and generic applications in source seem to be checked through the constraint-solver path instead. If it is dead, updating its body here keeps dead code on life support, and it could be deleted in a follow-up; if it has a caller I missed, could you point me at it? Either way it would help to resolve its status, because a reviewer can't judge whether the `nullptr` type argument here is correct without knowing whether this path is reachable.

Notes:
Deadness is pre-existing (only the call inside the body is changed by the PR), so removal
can reasonably be deferred to a follow-up; the ask is to resolve the function's status.
Related: C002.

### C004: The comment above the changed fold in `getGenericParamDefaultArgVal` no longer states what the fold produces

- Status: Keep
- Confidence: High
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-constraint.cpp:944-947`
- GitHub link: https://github.com/shader-slang/slang/pull/14626/files
- Scope decision: Direct
- Scope rationale: The candidate targets the fold-call lines the PR rewrote and the adjacent comment that the rewrite made stale and incomplete.
- Overlap decision: Keep
- Overlap rationale: Merged FG002 (the same invariant statement requested at the uncommented `CoerceToProperTypeImpl` fold site) into this comment, which already covers both producers.

Context:

```cpp
// The default-value expression for a generic value parameter must be
// folded into an `IntVal` before it can be stored in the argument list.
// For `Foo<let N : int = 4>`, this returns the folded integer value
// `4`. Constant folding can encounter circular defaults like
// `N = M, M = N`, so this path uses the same circularity guard as other
// semantic checks.
return visitor->ExtractGenericArgVal(
    valParam->initExpr,
    valParam->getType(),
    &newCircularityInfo);
```

Proposed comment:

> The comment above this call explains that the default folds to an `IntVal` and handles circularity, but it was written before the type argument and now understates the contract this PR relies on: the fold uses the parameter's *declared type*, so `Foo<let N : uint32_t = 16>` returns a `uint32_t`-typed value that compares equal to an explicitly-written `Foo<16>`. That type choice is the actual bug fix, and nothing at this site records it. Please extend the comment (here and at the matching default-fold site in `CoerceToProperTypeImpl`, which currently has no comment about the fold at all) to state the invariant: default arguments fold to the parameter's declared type so that implicit and explicit spellings yield identical `Val`s.

Notes:
The `CoerceToProperTypeImpl` site (`source/slang/slang-check-type.cpp:399-402`) has no
comment about the fold, only a pre-existing TODO about syntax cloning; the same invariant
statement is missing there. One comment at each producer is clearest, but the request is a
single contract. Related: C001, C005.

### C005: A null parameter type silently reproduces the bug this PR fixes; no assertion guards the invariant

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: invariant
- Location: `source/slang/slang-check-type.cpp:399-402`
- GitHub link: https://github.com/shader-slang/slang/pull/14626/files
- Scope decision: Direct
- Scope rationale: The candidate anchors on the argument expression the PR added at this call site.
- Overlap decision: Keep
- Overlap rationale: Same location cluster as C004 but a different problem: silent degradation to the pre-fix behavior, not a missing explanatory comment.
- Judgment decision: Keep
- Judgment rationale: The degradation path is real and mechanical: `ExtractGenericArgInteger` maps a null expected type to `AnyInteger` coercion, which is the pre-fix behavior, and neither default-fold site asserts the type is non-null. The analysis could not prove `valParam->getType()` can never be null at the solver-reached site (`getGenericParamDefaultArgVal`), which is exactly why making the guarantee explicit is worth asking; the comment asks for an assertion or a stated guarantee rather than a behavior change.

Context:

```cpp
args.add(ExtractGenericArgVal(
    valParam->initExpr,
    valParam->getType(),
    &newCircularityInfo));
```

Proposed comment:

> `ExtractGenericArgInteger` treats a null expected type as "fold with the argument's own type" — i.e. exactly the behavior that produced the bug this PR fixes. So if `valParam->getType()` were ever null or unchecked at either default-fold site, the change would silently degrade to the old buggy folding with no diagnostic. Is the parameter's type guaranteed checked and non-null at both call sites at this point in checking? If so, an assertion (or a comment naming the guarantee, e.g. the `CanSpecializeGeneric` state) would make the invariant enforceable instead of accidental.

Notes:
Uncertain whether `getType()` can actually be null here (the solver reaches this via
`addDefaultGenericArgConstraint`; `CoerceToProperTypeImpl` has already run
`ensureDecl(..., CanSpecializeGeneric)`). The ask is to make the guarantee explicit, not to
change behavior. Related: C001, C004.

### FG003: Test expected value depends on undocumented zero-initialization of an unbound uniform

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: function contract
- Location: `tests/language-feature/generics/generic-default-value-param-8479.slang:29-36`
- GitHub link: https://github.com/shader-slang/slang/pull/14626/files
- Scope decision: Direct
- Scope rationale: The candidate concerns arithmetic the PR's new test added.
- Overlap decision: Keep
- Overlap rationale: No other candidate covers the test's expected-value derivation.
- Judgment decision: Keep
- Judgment rationale: A survey of tests using unbound `uniform` globals did not establish a documented zero-fill convention for value reads in COMPARE_COMPUTE tests, so the fragility question is credible; the ask is small (a one-line comment or a deterministic store) and the author can also resolve it with a one-word answer if the convention is real.

Context:

```slang
uniform Payload y;
...
Payload.Hit h = y.hits[0];
...
Payload<16> z;
z.hits[0].value = 2;
Payload.Hit h2 = z.hits[0];

outputBuffer[0] = h.value + h2.value + 40;
// CHECK: 42
```

Proposed comment:

> The expected output `42` only holds if `y.hits[0].value` reads as `0`, i.e. if the test harness zero-fills the unbound `uniform Payload y`. Nothing in the test says this is the intended source of `h.value == 0`, so a harness behavior change would turn this regression test into a confusing failure unrelated to the parameter-type fix. A one-line comment ("`y` is unbound and reads as zero"), or writing a deterministic value through `y` before reading it, would make the expectation self-evident.

Notes:
Low confidence: zero-filling unbound parameters may be a slang-test convention; if so, this
can be answered in a word. The core repro only needs `Payload.Hit` to type-check against
`Payload<16>.Hit`, not the exact arithmetic.

### FG004: Test header comment phrasing garbles the failure mode

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `tests/language-feature/generics/generic-default-value-param-8479.slang:5-9`
- GitHub link: https://github.com/shader-slang/slang/pull/14626/files
- Scope decision: Direct
- Scope rationale: The candidate concerns the regression-explanation comment the PR's test introduces.
- Overlap decision: Keep
- Overlap rationale: No other candidate covers the test header prose.
- Judgment decision: Keep
- Judgment rationale: The sentence is genuinely hard to parse and can be fixed in one line; kept as a minor nit, not a blocker.

Context:

```slang
// Regression test for https://github.com/shader-slang/slang/issues/8479
// An unsuffixed integer literal default for a generic value parameter folded to a
// ConstantIntVal carrying the literal's own type instead of the parameter's declared
// type, so a global `uniform Payload` compared unequal to the spelling `Payload.Hit`:
//   error 30019: expected an expression of type 'Payload<16>.Hit', got 'Payload<16>.Hit'
```

Proposed comment:

> Minor: the clause "a global `uniform Payload` compared unequal to the spelling `Payload.Hit`" is hard to parse — it is the *types denoted by* the two spellings that compared unequal, and `Payload.Hit` here means the default-specialized nested type while `Payload<16>.Hit` is the explicit one. Consider rewording to something like "so the default-specialized `Payload.Hit` and the explicit `Payload<16>.Hit` denoted two distinct types that printed identically". The quoted E30019 below already makes the failure concrete; the sentence just needs to match it.

Notes:
Pedantic prose polish; safe to drop if the author prefers brevity. Not worth blocking on.

### FG005: Test directives do not include all the configurations the PR description claims

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `tests/language-feature/generics/generic-default-value-param-8479.slang:1-3`
- GitHub link: https://github.com/shader-slang/slang/pull/14626/files
- Scope decision: Direct
- Scope rationale: The candidate concerns the test directive lines the PR added.
- Overlap decision: Keep
- Overlap rationale: No other candidate covers the test configuration list.
- Judgment decision: Keep
- Judgment rationale: The mismatch is verifiable from the PR body ("passes vk/cpu/llvm/cuda") versus the three directives (default, `-vk`, `-cpu`); posting the question is cheap and a one-word answer resolves it either way.

Context:

```slang
//TEST(compute):COMPARE_COMPUTE(filecheck-buffer=CHECK): -shaderobj -output-using-type
//TEST(compute):COMPARE_COMPUTE(filecheck-buffer=CHECK): -vk -shaderobj -output-using-type
//TEST(compute):COMPARE_COMPUTE(filecheck-buffer=CHECK): -cpu -shaderobj -output-using-type
```

Proposed comment:

> The PR description says the test "passes vk/cpu/llvm/cuda", but the directive list only instantiates the default, `-vk`, and `-cpu` runs. Is the mismatch intentional (llvm/cuda covered by CI matrix defaults), or should matching directives be added here?

Notes:
The directives themselves are conventional and internally consistent; the concern is only
consistency with the PR body. May be resolved by a one-word answer rather than a change.

### FG006: Mixed use of `paramDecl` and `valParam` for the same declaration within `getGenericParamDefaultArgVal`

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: naming
- Location: `source/slang/slang-check-constraint.cpp:941-947`
- GitHub link: https://github.com/shader-slang/slang/pull/14626/files
- Scope decision: Direct
- Scope rationale: The PR's new lines introduce the second name into the cluster; the mixing is exposed by the changed lines.
- Overlap decision: Keep
- Overlap rationale: Same location as C004 but a different problem: local naming consistency, not the fold contract.
- Judgment decision: Keep
- Judgment rationale: The two names provably refer to the same `Decl*` in this branch, so the ask is a trivially safe one-token touch-up; kept as a nit.

Context:

```cpp
SemanticsVisitor::ConstantFoldingCircularityInfo newCircularityInfo(
    makeDeclRef(paramDecl),
    nullptr);
return visitor->ExtractGenericArgVal(
    valParam->initExpr,
    valParam->getType(),
    &newCircularityInfo);
```

Proposed comment:

> Inside this branch `paramDecl` and `valParam` are the same `Decl*` under two names, and the new code now uses both within four lines (`makeDeclRef(paramDecl)` above, `valParam->...` below). Using one name consistently (e.g. `makeDeclRef(valParam)`) would make it obvious the circularity guard and the fold target the same parameter.

Notes:
The `makeDeclRef(paramDecl)` line is pre-existing; the PR's new lines introduce the mixing.
Very minor; fine to fold into any other comment touch-up at this site.

---

## Needs Judgment Call

(No unresolved candidates. C003, C005, FG003, FG004, FG005, and FG006 were marked for
judgment during scope filtering and resolved with focused analysis; decisions and rationales
are recorded on each candidate above. All resolutions are Keep.)

---

## Dropped

### FG001: Two adjacent `nullptr` arguments with different meanings

- Status: Drop
- Confidence: Medium
- Scope: Direct
- Category: API shape
- Location: `source/slang/slang-check-shader.cpp:3843`
- GitHub link: https://github.com/shader-slang/slang/pull/14626/files
- Scope decision: Direct
- Scope rationale: Anchored on a line the PR rewrote.
- Overlap decision: Merged into C001
- Overlap rationale: The readability concern is one half of the same declaration-contract problem; C001's combined comment covers both the missing contract and the `nullptr, nullptr` call-site readability.

Context:

```cpp
arg.val = semanticsVisitor.ExtractGenericArgVal(argExpr, nullptr, nullptr);
```

Proposed comment (superseded by C001):

> Removing the `circularityInfo` default makes every type-agnostic caller spell out `nullptr, nullptr`, where the first `nullptr` means "no expected type" and the second means "no circularity guard". Adjacent same-looking arguments with different meanings are easy to mis-order or mis-edit later. An overload `ExtractGenericArgVal(Expr*)` (or keeping the default on the trailing parameter) would let the type-agnostic sites say what they mean.

Notes:
Same pattern at `source/slang/slang-check-type.cpp:254`. The same-line justification
question for the `nullptr` itself is separately preserved as C002.

### FG002: `CoerceToProperTypeImpl` fold site has no comment tying the new type argument to its purpose

- Status: Drop
- Confidence: Medium
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-type.cpp:399-402`
- GitHub link: https://github.com/shader-slang/slang/pull/14626/files
- Scope decision: Direct
- Scope rationale: Anchored on the lines the PR rewrote.
- Overlap decision: Merged into C004
- Overlap rationale: C004 already asks for the same invariant statement at both default-fold producers, including this site; a separate comment at the same conceptual level would be a duplicate.

Context:

```cpp
// TODO: this is one place where syntax should get cloned!
if (outProperType)
{
    ConstantFoldingCircularityInfo newCircularityInfo(
        makeDeclRef(valParam),
        nullptr);
    args.add(ExtractGenericArgVal(
        valParam->initExpr,
        valParam->getType(),
        &newCircularityInfo));
}
```

Proposed comment (superseded by C004):

> This is one of the two default-argument fold sites that constitute the actual bug fix, yet the only comment in the region is a pre-existing TODO about syntax cloning. A reader cannot tell why `valParam->getType()` is now passed (fold defaults to the declared type so implicit and explicit spellings compare equal) versus the `nullptr` used at explicit-argument sites. Please state that rationale here — this site is where a future regression in the default-type invariant would be introduced.

Notes:
The `source/slang/slang-check-type.cpp:399-402` hunk remains covered by C005 (anchored
there) and by C004's cross-referenced invariant request.

## Result (machine-readable)

```json
{"verdict":"REQUEST_CHANGES","bugs":1,"gaps":3,"questions":0,"diff_hash":"395c139c5016987c4f357c1bc8acc17ed022b134235dc1b4df8de3eb8958412a","reviewers_complete":true}
```

---

## Adjudication addendum (2026-11-19 03:05 UTC, post-verdict verification)

The 🔴 Reviewer A finding (third default-fold site, slang-check-overload.cpp:544, "survives for nested generics") does NOT reproduce. Verification: fresh PR-head build (wt-14626-verify, 2026.22-39-g6837bbbc0) and the master build (2026.13.1-32-g0b1fde0f) — six probes, all compile clean on BOTH builds, including A's exact `Outer<int>.Inner<float>` vs `Outer<int>.Inner<float,16>` assignment shape. Control: the PR's own test fails on master with E30019 and passes on the head — so the probe set can detect the failure class; the nested shape simply never manifests it, on any build.

Mechanism (read from source in the PR tree): the overload.cpp:544 untyped fold is real, but its result is always consumed through overload-candidate/unification machinery that repairs it — check-constraint.cpp:3805-3810: "If `val` is of different type than `paramDecl`, we want to insert a type cast" → `getTypeCastIntVal(paramDecl->getType(), val)`. The #8479-visible bug only ever manifested via the bare-name default fold (CoerceToProperTypeImpl, slang-check-type.cpp:396) where no unification pass runs — exactly the site the PR fixes. The getGenericParamDefaultArgVal site (slang-check-constraint.cpp:941) fix is likewise producer-side canonicalization (a unification call site compiles clean on master too, probe 2b).

Revised verdict: APPROVE_WITH_NITS — the REQUEST_CHANGES rested on the non-reproducing 🔴. Nits (apply without another review round): (1) solver-path distinguishing test (A's `f<let x : uint32_t = 16>()` snippet); (2) coercion-boundary diagnostic test (out-of-range/negative default); (3) optional consistency: thread the param type at overload.cpp:544 (still relies on downstream TypeCastIntVal repair); (4) optional, defer-with-rationale or follow-up issue: module-level API specialization coercion (slang-check-shader.cpp:3843) — latent, unproven user-visible.

Revised result:
```json
{"verdict":"APPROVE_WITH_NITS","bugs":0,"gaps":3,"questions":0,"diff_hash":"395c139c5016987c4f357c1bc8acc17ed022b134235dc1b4df8de3eb8958412a","reviewers_complete":true,"note":"A's 1 bug downgraded to consistency nit after non-reproduction on PR head AND master; original result block above preserved as the record of what A reported"}
```
