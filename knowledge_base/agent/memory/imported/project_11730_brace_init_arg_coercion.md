---
name: project_11730_brace_init_arg_coercion
description: "#11730 brace-init as function arg — PR #11818 non-draft, CI green, skiminki concern verified"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8f913829-59ec-421b-be4f-4e08f9280f4b
---

#11730: `foo({a, b})` (init-list arg where element is a vector) failed E30019 while `float3 c = {a,b}` and `return {a,b}` worked. Root cause: `createInvokeExprForExplicitCtor` gated its success `return true` behind `if (outExpr)`, so the `canCoerce` viability probe (no out-expr) returned a false negative → the `float3` overload candidate was wrongly dropped → fell back to per-element coercion. One-line fix: report viability independent of `outExpr`.

Draft fix = **PR #11818** (`Fixes #11730`, `pr: non-breaking`).

**07-14 skiminki-nv (assignee) design comment** (issue comment 4967180890): the 3 cases aren't equivalent — case 3 must go through overload resolution; an init-list matching multiple overloads should be flagged AMBIGUOUS. Asserted slangc's overload logic already handles it.

**slang-fixer VERIFIED (07-14, head 61c9b80e3):** his `overloadedFunc({a,b})` example (overloads `(int2,int)`/`(int3)`/`(ABC)`) → correctly errors E39999 ambiguous (int3 + ABC candidates). Revert drill: pre-fix the same call gave spurious E30019 (int3 candidate wrongly dropped). So the fix **converts a spurious type-mismatch into the correct pre-existing ambiguity diagnostic** — strengthens, not erodes, ambiguity detection. Added `init-list-as-arg-ambiguous.slang` DIAGNOSTIC_TEST (PASS). Replied on issue = comment 4967815852.

**✅ MERGED (07-14):** skiminki-nv merged PR #11818 (merge commit `3eeda847ce`); issue #11730 auto-closed via `Fixes #11730`. Fixer reaped worktree + sentinel. Shipped set: one-line `createInvokeExprForExplicitCtor` probe-viability fix + 3 regression tests (positive, over-population negative, ambiguous-overload). CHAIN CLOSED — no action owed.

Path: skiminki approved ("Looks reasonable", review 4693690220) after ambiguity verification → merged same day.

**Adjacent finding (out of scope, flagged for own ticket):** the *error*-return path in same function still emits its diagnostic during the `canCoerce` probe (not outExpr-gated) → probing a non-viable explicit-ctor candidate can leak a hard diagnostic before ranking. Principled fix mirrors the success-path fix. Reviewer A flagged same line independently.
