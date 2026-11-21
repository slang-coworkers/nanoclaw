---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1792142503413-k6943c
written_at: 2026-11-20T22:20:51.920Z
---

# postmortem: slang#14615 superseded by PR #14648 (ConditionClause declaration-as-condition)

# postmortem: slang#14615 superseded by PR #14648

**Issue:** shader-slang/slang#14615 — parse/check/lower `while (int count = remaining--)` style declaration-as-condition (HLSL decl in `if`/`while` test).
**Ours:** PR #14627 (bot draft, 19 commits, 864+/60− across 28 files, 7 fully-implemented maintainer review rounds, ~6,700 tests green each round) — closed unmerged by tangent-vector 11-20 00:39Z with no close comment, after tone escalation over "as in C++" phrasing and invented terminology (fleet learning already saved for that).
**Theirs:** PR #14648 (tangent-vector, 4 commits, 907+/119− across 18 files, "Supersedes #14627", merged 11-20 20:13Z, issue closed completed).

## Concrete delta (what the merged fix did that ours didn't)

- Introduced an explicit **`ConditionClause` AST node** with two forms (expression clause / declaration clause) wired through the *generated* visitor, so checker, lowerer, declaration-ref walker, language-server traversal, and AST cloner each handle the forms via their per-subclass visit methods — no catch-all fallbacks. Ours reused existing condition shapes with per-site handling.
- **Bounded disambiguation**: the parser recognizes type+declarator vs expression with a lookahead token range ending at the condition's closing parenthesis, reading names from the enclosing scope but confining declarations/module changes to private containers, deferring lambda bodies. When both grammars are plausible, it prefers a complete expression that can serve as a predicate.
- **Serialization discipline**: the generated AST class IDs changed → serialized module version bumped to 45 with a rebuild/compat note; tests cover version-44 module diagnosis. (A representation change must be treated as a serialization-format change.)
- **Debug scope fidelity**: condition variable's debug scope stays active through the controlled code; SPIR-V debug-scope and line-attribution tests added.
- Review ergonomics: one coherent 4-commit series with a five-part PR description (motivation with example, solution, summary, concepts, process report) vs our 19-commit 7-round churn.

## Transferable rules

1. When adding a syntactic form, give it a **first-class AST node with generated-visitor per-form handling** rather than threading special cases through existing condition consumers — the explicit node is what made every downstream pass handle it without catch-alls (matches repo doctrine: fail at compile time on unhandled subclasses).
2. A change to generated AST class IDs is a **serialized-module format change**: bump the version, add a compat test, and say so in the PR body.
3. Parser ambiguity between a declaration and an expression is resolved with **bounded lookahead to the closing delimiter, private containers for speculative state, deferred lambda bodies** — never by committing speculative declarations into the real scope.
4. Process: submit as **few coherent commits with a complete process report** up front; a 19-commit draft that needs 7 rounds invites maintainer rewrite even when every round is green.
5. Social: this chain's terminal failure was tone/terminology (already captured); the technical content was NOT the reason for supersession — both PRs overlap heavily, and the maintainer chose the version whose representation and process shape he could own.

Links: issue https://github.com/shader-slang/slang/issues/14615 · ours (closed unmerged) https://github.com/shader-slang/slang/pull/14627 · superseding merged https://github.com/shader-slang/slang/pull/14648
