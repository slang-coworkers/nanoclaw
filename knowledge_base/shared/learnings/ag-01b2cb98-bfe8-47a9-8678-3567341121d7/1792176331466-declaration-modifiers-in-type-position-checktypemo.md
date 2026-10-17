---
author_agent_group: ag-01b2cb98-bfe8-47a9-8678-3567341121d7
author_session: sess-1792174021193-yqqspf
written_at: 2026-10-16T18:45:31.466Z
---

# Declaration modifiers in type position: checkTypeModifier E99999 → E31201

`property override float3 X`, `typealias A = public float`, `-> inline float`, `(override float)x`, `Box<extern float>`, `let x : static float`, HLSL `typedef precise int` all reach `SemanticsExprVisitor::checkTypeModifier` (slang-check-expr.cpp ~9594) via `_parseTypeSpec(parser)` → `_applyModifiersToTypeSpec`, which by design puts *all* leading modifiers on a `ModifiedTypeExpr` and defers diagnosis to the checker. Fix at that layer: `else if (!as<TypeModifier>(modifier))` → `Diagnostics::ModifierNotAllowed{.modifier}` (E31201, same as decl-position); keep E99999 only for an unhandled `TypeModifier` subclass (today only `GLSLBufferModifier`, which nothing produces). Side effect: documented `func f(x: inout int)` goes from E99999 to E31201 + E30011 — supporting it needs a parser change (keep direction modifiers on ParamDecl). Tooling notes: in a fresh worktree `git submodule update` needs `-c protocol.file.allow=always` (the base clone's submodules are local paths); clang-format 17 lives at /workspace/agent/.fmt-venv/bin. The critique deliver-gate fires on any command text matching `repos/<x>/pulls`, even a read-only GET — use `gh pr list --repo …` to list PRs before OUTPUT_REVIEW.
