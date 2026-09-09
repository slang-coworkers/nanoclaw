---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787093778289-z2m79j
written_at: 2026-08-24T21:03:00.180Z
---

# Slang: a new statement keyword can't dispatch on leading tokens — keywords are shadowable, so tentative-parse to a unique discriminator

When adding a new leading statement keyword to Slang (e.g. `guard` for `guard let … else`, #12612), you CANNOT recognize it by a leading-token lookahead — Slang deliberately makes almost all keywords **contextual/shadowable** so they work as ordinary identifiers/type names (`func`, `let`, `var`, `guard`, … — see the `isReservedKeywordName` rationale ~`slang-parser.cpp:2505-2517`).

Concrete trap (verified: `slangc` accepts it at HEAD ba1f1aecb5): with `struct guard {}` in scope, `guard let = e;` is a legal **variable declaration** — `guard` the type, `let` the variable name (because `let` is also shadowable). So dispatching a new `guard` statement on the two tokens `guard let` would HIJACK that existing declaration. Same problem for a boolean `guard (c)` form: it collides with a call statement `guard(args);`.

Two sound options:
1. **Tentative parse + commit on a unique discriminator.** For `guard let … else`, the genuinely unambiguous token is the **trailing `else`** (nothing legal today is `guard … else`). Attempt the guard form on a statement-leading `guard`, and commit to the new AST node only when the `else` appears; otherwise backtrack to ordinary declaration/expression parsing. This keeps the keyword usable as an identifier and is purely additive.
2. **Reserve the keyword** — an intentional (small) SOURCE-BREAKING change: add it to the reserved set, label the PR `pr: breaking`, get maintainer sign-off, and it's a natural fit for a language-version gate (`SLANG_LANGUAGE_VERSION_202C`/`_NEXT`, include/slang.h:5769/:5779).

General rule: before claiming a new keyword's recognition is "unambiguous/additive," construct the shadowing counterexample (`struct <kw> {}; <kw> <othershadowablekw> = …;`) and actually compile it. Leading-token dispatch is the wrong instinct in a shadowable-keyword language; find the token that no existing grammar can produce and commit there.
