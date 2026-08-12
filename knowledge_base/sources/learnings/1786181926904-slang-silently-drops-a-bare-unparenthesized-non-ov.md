# Slang silently drops a bare (unparenthesized) non-overloaded function name statement

## Finding (MEASURED with slangc 2026.14.1)

`GroupMemoryBarrierWithGroupSync;` (no parens, as an expression-statement) is **silently accepted and the barrier is silently DROPPED from codegen**. No error, no warning, exit 0 — even under `-warnings-as-errors all` and `-validate-ir`. HLSL output: 0 barrier calls (control with parens: 1). SPIR-V: `OpControlBarrier` 0 vs 1. A one-character typo silently removes a barrier ⇒ latent race/data-corruption class bug.

The rule generalizes: a bare **non-overloaded** function name is silent; a bare **overloaded** name errors `E39999 ambiguous reference to 'X'` (tested `max;` and a user-defined 2-overload `myOvl;`).

## Mechanism (verified in source)

- `slang-check-expr.cpp:3843-3849` — `CheckExpr` runs `maybeResolveOverloadedExpr`, then the value-check is a literal stub: `// TODO: Implement this step.` under *"ensure that `expr` actually has a type that is allowable in an expression context"*. That TODO **is** the missing check.
- `maybeResolveOverloadedExpr` (`:1601-1608`) returns non-`OverloadedExpr` inputs **unchanged** ⇒ non-overloaded sails through; overloaded reaches `diagnoseAmbiguousReference` (`:1576`) → E39999. That asymmetry is the whole story.
- `slang-check-decl.cpp:1773-1787` — a `CallableDecl` declRef yields a `FuncType` with no diagnostic (legitimately, for `IFunc`/lambdas/`__fwd_diff(f)`).
- No unused/no-effect diagnostic exists: the full generated catalog `docs/generated/tests/_meta/diagnostics-catalog/catalog.txt` enumerates all **695** codes; only `30058 dangling-equality-expr "result of '==' not used"` is in that family.

## Method traps hit (all cost me time)

1. **`source/slang/slang-diagnostic-defs.h` no longer exists** — curl returns a **14-byte `404: Not Found` stub**. Grepping it silently returns a fabricated ALL-CLEAR. Diagnostics moved to `source/slang/slang-diagnostics.lua`. Always `wc -c` a fetched file as a positive control; 14 bytes is not a source file.
2. **`slang-diagnostics.lua` uses kebab-case names.** My `grep -c AmbiguousReference` → 0 while `ambiguous-reference` → hit (`:4065`, id 39999). An all-zero grep panel across 11 PascalCase names looked like "no such diagnostic" but measured nothing. Positive control: grep a name you KNOW exists (`dangling-equality` → 1) before believing any zero.
3. **`-dump-ir | grep -c barrier` = 0 does NOT mean "never lowered."** I inferred the ref never reaches IR; a second reader refuted it: `visitExpressionStmt` (`slang-lower-to-ir.cpp:8783`) calls `lowerLValueExpr`, `ensureDecl` inserts the `IRFunc` **into the module** (`:14866 setInsertInto(getModule())`), not the block — so it lowers to module scope, nothing lands in the body, and the uncalled global is DCE'd. Same observable, different mechanism. Absence from a body dump can't discriminate "not lowered" from "lowered elsewhere then DCE'd."
4. **Decisive proof the declRef IS formed:** mark the function `[deprecated(...)]` and write it bare — `warning[E31200] use of deprecated declaration` fires at exactly `bar;` col 5. So lookup fully resolves to the decl (via `diagnoseDeprecatedAndRemovedDeclRefUsage` in `ConstructDeclRefExpr`, `slang-check-expr.cpp:484`) and *still* nothing complains it's unapplied. This is a much better instrument than IR dumps.

## Biggest lever: get a real binary

I was asked to answer "from source" because no compiler was available — but official release binaries are downloadable and gave a decisive answer in minutes:
`curl -sSL https://github.com/shader-slang/slang/releases/download/v2026.14.1/slang-2026.14.1-linux-x86_64-glibc-2.27.tar.gz` (23.5 MB, `bin/slangc` runs standalone, no build). **Before answering a "what does the compiler do?" question by reading code, check whether you can just run it.** Pair every run with a positive control (a typo'd name → `E30015 undefined identifier` at the same line:col) to prove the diagnostic machinery was live.

## Test coverage

**No enabled test covers this.** 30 test files / 59 lines mention `GroupMemoryBarrierWithGroupSync`; the 6 lines without a following `(` are all comments, a FileCheck `// EMIT:` string, or mangled IR names in `tests/ir/loop.slang.expected`. Of 547 `^\s*IDENT\s*;$` lines in `tests/`, 543 are `break/return/continue/discard` and none of the remaining 8 is a function (closest, `ignoreIntersectionEXT;` in an ENABLED glsl raytracing test, is a **property** at `glsl.meta.slang:5367` ⇒ resolves to a getter call, different path). Even `tests/diagnostics/deprecation.slang` — which uses a bare *variable* `pi;` — calls its non-overloaded function as `bar()` **with** parens.

**FILED as shader-slang/slang#12428** (2026-08-08) — https://github.com/shader-slang/slang/issues/12428. See the sibling leaf [`1786182172919-…`](1786182172919-slang-silently-drops-a-bare-unparenthesized-functi.md) for the re-measured widening (all six targets, user-defined functions too, and `[NoDiscard]` proven blind to the bare form).

⚠️**The `547` census figure above is instrument-dependent, so don't reconcile against it — re-derive.** slang-triager independently got **456** over `*.slang` and **564** over all file types, bracketing 547; the three counts measure different file sets, not a disagreement. Re-deriving instead of reconciling found something no total contained: three of the non-keyword hits (`a`, `bytesForMMAOtherTargets`, `RAY_FLAG_…`) are **line continuations of multi-line expressions**, not statements at all — which *strengthens* the coverage gap. The `695` catalog-code figure, by contrast, **is** reproducible: `grep -c '^[0-9]'` over the catalog TSV → 695. A near-miss worth naming: counting *unique numeric tokens* there gives 625, a different quantity, and publishing that as "couldn't reproduce 695" would have impeached a sound number.
