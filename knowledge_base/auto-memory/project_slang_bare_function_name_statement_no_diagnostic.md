---
name: project_slang_bare_function_name_statement_no_diagnostic
description: "TRIGGER: filing or triaging the missing-diagnostic bug where `GroupMemoryBarrierWithGroupSync;` (no parens) compiles exit 0 silently and emits ZERO barriers. Main-verified at master 716ec597: the ambiguity gate needs an OverloadedExpr so a single decl cannot trip it, and SemanticsVisitor::CheckExpr carries a literal TODO where the value-check belongs. HELD for operator authorization to file."
metadata:
  node_type: memory
  type: project
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

**2026-08-08, from `slang-discord-support`'s Discord summon (`wide0125`, thread `1535572351964414052`).** A user wrote `GroupMemoryBarrierWithGroupSync;` — **no parentheses**. It is a bare function-name expression statement, i.e. a no-op that discards the function reference.

**Their measurement (real `slangc` 2026.14.1, user's snippet verbatim):**
- Compiles at **exit 0, no error, no warning — even under `-warnings-as-errors all`.**
- Emits **zero barriers**: **0 vs 1** on hlsl / glsl / metal / wgsl, and **0 vs 379** barrier mentions in `-dump-ir`.
⇒ **Silent loss of group synchronization: a real data race with no feedback.** The user's shader is wrong and the compiler says nothing.

## ✅ Main-verified at `master=716ec597fc9c85111cd2fa06ba4e89bc4469b6b2` (both coordinates exact)

```cpp
// slang-check-expr.cpp:1483-1492  — the ambiguity gate
bool SemanticsVisitor::maybeDiagnoseAmbiguousReference(Expr* expr)
{
    if (auto overloadExpr = as<OverloadedExpr>(expr))        // ← requires an OverloadedExpr
    { ... diagnoseAmbiguousReference(overloadExpr); return true; }

// slang-check-expr.cpp:3843-3851  — where the check belongs
Expr* SemanticsVisitor::CheckExpr(Expr* uncheckedExpr)
{
    auto checkedTerm  = CheckTerm(uncheckedExpr);
    auto checkedExpr  = maybeResolveOverloadedExpr(checkedTerm, LookupMask::Default, getSink());
    // Next, we want to ensure that the `expr` actually has a type
    // that is allowable in an expression context (e.g., make sure
    // that `expr` names a value and not a type).
    //
    // TODO: Implement this step.          // ← literal, unimplemented
    return checkedExpr;
}
```

⇒ **Mechanism holds as they described it:** `GroupMemoryBarrierWithGroupSync` has a **single** declaration, so no `OverloadedExpr` is formed and the ambiguity path at `:1484` **cannot fire by construction** — it is not a missing branch, it is an inapplicable one. The step that *would* catch "this expression names a function, not a value" is the `TODO` at `:3849`.

⭐⭐ **Main's addition, which broadens the finding rather than the fix:** the TODO sits in **`SemanticsVisitor::CheckExpr`** — the *general* expression-check entry point, not a statement-specific path. So the gap is **"nothing verifies that a checked expression is value-shaped"**, of which the bare-function-name statement is one symptom. **Cite the function, not just the line** — a reviewer who reads `:3849` in isolation sees a TODO; a reviewer told it is in `CheckExpr` sees the blast radius.

⚠️ **Scope caution before anyone proposes the fix:** implementing the TODO changes what *every* expression context accepts, which is exactly the "front-end fold unlocks four backends" shape that has been both the right layer and a breaking-change hazard on this codebase. A narrower first step — diagnose a **statement-expression whose result is unused and whose type is a function** — is testable and near-zero blast radius. **Both are defensible; not our call to pick.**

## Status

**HELD for operator authorization** — filing a GitHub issue is a public write, and `slang-discord-support` has no GitHub write scope (they offered a draft on request, correctly, rather than posting). No in-tree test covers this: their claim, and `search/code` for `GroupMemoryBarrierWithGroupSync` under `path:tests` returns 30 hits — all of which are ordinary *called* uses, so **none is a bare-name regression test**. ⚠️ Note `search/code` is default-branch-only and cannot see branch work, so that is a master-only negative.

**Filing content ready:** user snippet, the 0-vs-1 / 0-vs-379 measurements per target, the two source coordinates above, the `CheckExpr` framing, and the "no in-tree test" note. Add a regression test as a `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):` case — the natural form for a missing-diagnostic bug.

## ✅ 2026-08-08 — DRAFT RECEIVED AND FULLY VERIFIED; the one gap it declined I closed

Draft at `/workspace/inbox/a2a-1786183311257-j7hfgn/bare-function-reference-no-diagnostic.md` (5,869 B). **Every coordinate re-verified by me at `716ec597`:**

| cited | verified |
|---|---|
| `hlsl.meta.slang:11873` single decl | ✅ `void GroupMemoryBarrierWithGroupSync()` at :11873, one declaration |
| `slang-check-expr.cpp:1483-1485` gate | ✅ `if (auto overloadExpr = as<OverloadedExpr>(expr))` |
| `slang-check-expr.cpp:3834` / TODO at `:3849` | ✅ `CheckExpr` opens :3834; TODO is the **last statement before `return checkedExpr;`** |
| `slang-check-stmt.cpp:684` `visitExpressionStmt` | ✅ calls `CheckExpr`, then only a dangling-`==` warning path |
| **25 `CheckExpr` call sites (5/11/5/4)** | ✅ exact: expr 5, stmt 11, decl 5, modifier 4 |

⭐⭐ **The `max;` discriminating control is the load-bearing item and the mechanism is coherent:** `max` has **multiple** decls in `hlsl.meta.slang`, so a bare `max;` forms an `OverloadedExpr`, the `:1485` gate fires, and it errors `E39999`. **Having exactly ONE overload is precisely what lets the barrier case through.** ⇒ **a reviewer probing with an overloaded intrinsic gets a false all-clear** — which is the single most likely reason a correct report would be bounced as unreproducible. Putting it in the body rather than in notes was the right call.

✅ **CLOSED THE ONE GAP THE DRAFT DECLINED ("did not search existing issues").** Searched with a control first (`is:issue diagnostic` → **575**, so the instrument works):
- `"without parentheses"` → 1 (#11349, order-independent lookup — unrelated)
- `"no parentheses" barrier` → 0
- `GroupMemoryBarrierWithGroupSync` → 34, all unrelated subjects (#10641 DXIL specialization, #10695 build failure, #8774 WGSL uniformity)
⇒ **no duplicate.** ⭐**And two same-genre precedents worth citing in the filing:** **#12261** *"Statement labels are accepted on non-breakable statements"* and **#12222** *"Lexer does not diagnose lone UTF-8 continuation bytes"* — both open missing-diagnostic bugs, which establishes that this class is accepted as filable here rather than dismissed as pedantry.

⭐ **Their self-correction is worth recording as the method that produced the stronger claim:** they had been citing the TODO bare as `:3849`; naming the enclosing function revealed it is the last statement before the `return`, i.e. **the step is entirely absent, not partially implemented.** ⇒ **a line citation states where something is; a function citation states what it is part of, and only the second supports a scope claim.**

**Status: still authorization-held (public write). Draft is file-ready as-is** — I would add only the duplicate-search result and the #12261/#12222 precedent line.
