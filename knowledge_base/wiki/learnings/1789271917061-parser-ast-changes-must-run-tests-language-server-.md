---
title: "Parser/AST changes must run tests/language-server (malformed-input crashes + shared-server collateral)"
type: learning
topic: misc
source: learnings/1789271917061-parser-ast-changes-must-run-tests-language-server-.md
---

# Parser/AST changes must run tests/language-server (malformed-input crashes + shared-server collateral)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787273918518-t41g0t
written_at: 2026-09-13T03:58:37.061Z
---

# Parser/AST changes must run tests/language-server (malformed-input crashes + shared-server collateral)

When changing the Slang **parser or AST** (especially building new `Expr`/AST nodes during parsing), run `tests/language-server/` locally — NOT just `tests/diagnostics` + `tests/compute`. The language-server *robustness* tests feed malformed/partial source (e.g. `robustness-4.slang` is literally `[]`) and require the language server to survive without crashing. A change that is clean on well-formed input can still crash on malformed input.

**Two hard-won facts:**

1. **`Parser::ReadToken(TokenType::Identifier)` on a mismatch returns the *mismatched* token without advancing** (see `readTokenImpl`: on non-recovery it does `Unexpected(...)` then `return tokenReader.peekToken();`). So if you build an AST node from that token (e.g. `varExpr->name = tok.getName()`), you get a node with a **null name**; a later `CheckTerm`/lookup on it crashes. Guard construction on `tok.type == TokenType::Identifier` and skip building the node otherwise (leave it null so downstream uses its null-safe path). Fix the *producer* (parser), not the consumer.

2. **Shared test-server collateral.** `slang-test -use-test-server -server-count N` reuses server processes across tests. If ONE test crashes the server, **every other test on that server fails too** — so a broad, cross-platform, *non-deterministic* failure set (the exact list differs per run/CI-vs-local) usually traces to a single crashing test. Isolate: run the suspect tests one at a time; the one that fails **deterministically in isolation** is the root cause; the ones that pass alone but fail in the suite are collateral. Fixing the single crash fixes the whole set.

Context: shader-slang/slang#12674 (PR turning bracket-attribute names into `Expr`s). Local verification of diagnostics+compute was green, but 13 `tests/language-server/` tests failed in CI — all collateral of a `[]` crash. Also applies to slang-parser.cpp:129 `currentModule` defaulting null on the reflection/string-parse path (`parseTermFromSourceFile` doesn't set it) — guard `(cond && parser->currentModule)` before `->ownedScope`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789271917061-parser-ast-changes-must-run-tests-language-server-.md`_
