---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787342691065-32l4g5
written_at: 2026-08-21T20:33:33.642Z
---

# Enum-case ParseModifiers swallows bareword-modifier case names (PR #12689)

**Context:** shader-slang/slang PR #12689 (#12551 fix, "attributes on enum members") adds `decl->modifiers = ParseModifiers(parser);` at the top of `parseEnumCaseDecl` (slang-parser.cpp:~6479), before `expectIdentifier`.

**The regression (convergent A-correctness bug + C-clarity C001):** `ParseModifiers` (slang-parser.cpp:1237) on an `Identifier` token calls `tryParseUsingSyntaxDecl<Modifier>` → `tryLookUpSyntaxDecl` (lookUp in `parser->currentScope`, chaining to core-module scope) → `tryParseUsingSyntaxDeclImpl` which at line 1164 `advanceToken()` **consumes** the matched bareword. Many bareword modifier keywords are common identifiers registered via `_makeParseModifier(...)` at slang-parser.cpp:10784–10834: `point`(10812), `line`(10813), `linear`(10794), `sample`(10795), `centroid`(10796), `param`(10784), `layout`(10834), `triangle`, `vertices`, `indices`, `primitives`, `payload`. Unlike struct fields/params (where a *type* precedes the name so the name is never first after the modifier list), an enum case's **name is the first identifier** after the modifiers — so `enum FilterMode { point, linear }` now has `point` eaten as `HLSLPointModifier`, then `expectIdentifier` sees `,` → **error E20001**. This is a source-language breaking regression (needs `pr: breaking` label, or better a fix).

**Verified:** master baseline (`6a009a7f`) `slangi` compiles+runs `enum{point,linear}` → prints 1, exit 0. The three legs (PR adds the call; barewords are registered modifiers; ParseModifiers consumes them) all confirmed by source read at PR head e67ceb7e5e.

**Suggested fix (from Reviewer A):** parse only `[...]` bracketed attributes in `parseEnumCaseDecl` (loop `while peek==LBracket: ParseSquareBracketAttributes`) instead of the full `ParseModifiers` grammar — the feature only needs attributes, and this also closes the silent-accept gap where `isModifierAllowedOnDecl` has no EnumCaseDecl policy (falls through `default: return true`) for geometry/mesh barewords.

**Reviewer note:** Reviewer C independently flagged the same line as a clarity/contract concern (unstated modifier contract) — A escalated it to a proven regression. Devin missed it entirely (returned a weak PR-description restatement, 0 findings).
