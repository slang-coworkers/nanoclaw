---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787346795755-h151zo
written_at: 2026-08-21T21:22:57.434Z
---

# [approver/challenger-probe] New declaration-warning: prove zero blast radius via core-module + existing-test enumeration keyed on the exact AST gate

## Symptom / context
PR shape: a new **warning** that fires when a source modifier appears on a
particular declaration kind (here slang#12557 — E31228 when `constexpr` leads a
`CallableDecl`, via a disjoint `else if (as<CallableDecl>(syntaxNode))` branch in
`checkModifier`). Prior recall warned twice about this class: (a) a
diagnostic-surfacing change's blast radius = *every* input that already triggers
the diagnostic, which can break **pre-existing clean-output tests not in the
diff** (CodeRabbit/Devin miss these — they don't run the suites); (b) an
`as<CallableDecl>` gate once failed to exclude imported/bodyless decls → E45001
regression.

## How to clear it deterministically (this worked, decision was WOULD_APPROVE and agreed with the human)
1. **Enumerate the trigger in the CORE MODULE / prelude**, keyed on the EXACT AST
   predicate the gate uses — not the surface keyword. For `constexpr`-on-callable:
   grep `.meta.slang` for `constexpr` and separate the **parameter** uses
   (`constexpr int offset`, `constexpr String` = `ParamDecl : VarDeclBase`, which
   the `CallableDecl` gate is disjoint from → stays silent) from any
   **declaration-leading** use on a callable (would newly warn on every compile).
   Result here: ZERO callable cases; all core hits are params. `slang-cuda-prelude.h`
   `static constexpr __device__` is raw **C++**, never parsed by `checkModifier`.
2. **Enumerate the trigger in EXISTING TESTS** (exclude the PR's own new files).
   All 26 pre-existing `constexpr` test files used it on a param or in comments —
   zero callable cases → zero test blast radius.
3. **Confirm empirically via CI at head**: a new warning that disturbed a
   pre-existing clean-output test would redden a `test-slang` leg. Dedup
   check-runs by name→latest (superseded reruns show old "failure"); here 86
   distinct checks all green.
4. **Over-fire bound**: a semantic-check hook like `checkModifier` runs only on
   modifiers **parsed from the current TU**; imported binary-module decls aren't
   re-checked → the imported-decl over-fire (the E45001 prior) can't occur, and
   the core-module enumeration is the empirical confirmation.
5. **Test-vacuity**: confirm the new tests assert on the **message text**, not a
   bracketed `E<code>` — a code-based `CHECK-NOT` can match nothing and pass
   vacuously. An exhaustive-mode test that leaves the supported case (param)
   un-annotated is a real negative control.

## Transferable rule
For a new declaration-level diagnostic, "zero blast radius" is a **provable
enumeration**, not a plausibility call: grep the core module and existing tests
for the trigger keyed on the *exact AST class the gate matches* (separate the
sibling shapes the gate is disjoint from), then confirm with green CI at head
across the suites that would run the affected inputs. A removed "does-not-warn"
test that asserted the now-reversed contract is a required contract flip, not a
coverage loss — verify its scenario is re-covered by a new positive test.
