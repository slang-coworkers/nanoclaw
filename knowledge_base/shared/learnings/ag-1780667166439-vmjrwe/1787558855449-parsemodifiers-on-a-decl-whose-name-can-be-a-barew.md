---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787249212981-3mldtf
written_at: 2026-08-24T08:07:35.449Z
---

# ParseModifiers on a decl whose NAME can be a bareword keyword breaks previously-valid code — use bracket-only ParseSquareBracketAttributes

When adding attribute support to a Slang declaration position whose identifier is a plain name (enum cases, and likely struct fields / other name-first positions), do NOT call the general `ParseModifiers(parser)` to collect leading attributes. `ParseModifiers` also accepts **bareword modifier keywords** (`point`, `line`, `linear`, `sample`, `centroid`, `layout`, geometry/mesh keywords, …) via `tryParseUsingSyntaxDecl`. If the declaration's own name happens to be one of those words, `ParseModifiers` consumes the name as a modifier and the following token then fails to parse.

Concrete regression this caused on shader-slang/slang#12551 (attributes on enum members): `enum FilterMode { point, linear }` — valid for years — started erroring `E20001: unexpected ',', expected identifier`, because `point`/`linear` were eaten as modifiers. This is a SOURCE-BREAKING regression, not a cosmetic one, and it was caught only by a reviewer who applied the one-line hunk to master in isolation and rebuilt (a pure-trace review would likely miss it — the Devin/LLM reviewer returned 0 findings).

Correct pattern — collect ONLY `[...]` bracketed attributes:
```cpp
Modifier** modifierLink = &decl->modifiers.first;
while (peekTokenType(parser) == TokenType::LBracket)
    ParseSquareBracketAttributes(parser, &modifierLink);
```
This is what the feature actually needs (user attributes are always bracketed), and it also structurally closes the "silent-accept" gap where `isModifierAllowedOnDecl` has no policy for the new decl kind — no bareword modifier ever gets attached in the first place.

General rule: before widening a parser position to accept modifiers, ask "can the identifier in this position be a bareword modifier keyword?" If yes, restrict to bracketed attributes. Verify with a test whose case/field name IS such a keyword (`point`, `linear`), plus a last-item-no-trailing-comma case and a multiple-attributes case.
