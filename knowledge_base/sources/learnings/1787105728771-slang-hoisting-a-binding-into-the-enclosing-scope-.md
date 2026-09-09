---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787093778289-z2m79j
written_at: 2026-08-19T02:15:28.771Z
---

# Slang: hoisting a binding into the enclosing scope — switch-case dominance hole + overloadable-! trap (let...else, #12612)

Two non-obvious traps for any Slang feature that unwraps/binds and then hoists the binding into the ENCLOSING scope (guard-style `let ... else`, #12612). Both were caught only by independent review of a design note; both are real correctness bugs, not style.

1. **Switch-case alternate-entry dominance hole.** A `switch` body is a SINGLE shared block (`ParseSwitchStmt` → `parseBlockStatement`, slang-parser.cpp:6588); each `case` is a standalone `CaseStmt` LABEL in that block's statement sequence (`ParseCaseStmt`, :6592-6599), i.e. an alternate ENTRY POINT into the same scope. So if you place a binding-hoisting construct directly in a switch body, the hoisted binding becomes a member of the shared block scope, but a dispatch to a LATER case bypasses the construct that INITIALIZED it — you can read an uninitialized/absent binding. Rule: a hoisted binding is only sound where the construct DOMINATES its uses. "Directly inside a braced block" is NOT sufficient for a switch body. Conservative v1 fix: reject the construct directly in a switch body; require an explicit case-local `{ }` block (whose own scope restores dominance). Same class of hazard: a decl as the UNBRACED body of an if/loop gets no scope, so it can hoist past a skipped path — reject that too.

2. **Unary `!` is overloadable — don't negate a duck-typed predicate.** `if(let x = e)` desugars to a predicate `$tmp.hasValue` fed straight through the `if` predicate's boolean coercion (`checkPredicateExpr`, slang-check-stmt.cpp:257). If you write the guard/negated form as `!$tmp.hasValue`, you route through operator `!`, which is OVERLOADABLE (operator resolution, slang-check-decl.cpp:15518) — it can reject or alter a duck-typed operand that `if(let)` accepts. To match `if(let)` semantics EXACTLY, keep the predicate `$tmp.hasValue` (no `!`) and put the divergent/negative code on the ELSE arm: `if ($tmp.hasValue) { } else { S }`. Add a duck-typed-parity test (a struct with `.hasValue`/`.value` but not `Optional`).

General lesson: for a "recognize divergence in a block" checker, use ONE recursive predicate with a block/sequence rule — a construct you don't analyze (switch, lone discard, throw-caught-inside) is not itself a divergence WITNESS but must not POISON the sequence: keep scanning; a later `return`/`break`/`continue`/escaping-`throw` still makes the block diverge. `else { switch(){} return; }` diverges; `else { switch(){} }` does not.
