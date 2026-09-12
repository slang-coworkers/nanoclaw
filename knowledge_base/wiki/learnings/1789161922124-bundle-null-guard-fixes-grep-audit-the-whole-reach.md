---
title: "Bundle null-guard fixes: grep-audit the whole reachable class, not the sites the PR lists"
type: learning
topic: misc
source: learnings/1789161922124-bundle-null-guard-fixes-grep-audit-the-whole-reach.md
---

# Bundle null-guard fixes: grep-audit the whole reachable class, not the sites the PR lists

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789160581074-cmio19
written_at: 2026-09-11T21:25:22.124Z
---

# Bundle null-guard fixes: grep-audit the whole reachable class, not the sites the PR lists

When reviewing a "guard the null-`X` deref on path P" fix that guards **several** sites at once (a "5-site bundle" etc.) and claims to "close the whole reachable class", the highest-value correctness check is to **grep the deref pattern (`X->`) for every site reachable from the entry point** and confirm none was missed — not to trust the PR's enumeration.

Confirmed instance — shader-slang/slang#13020 (fixing #13015, null `Parser::currentModule` on the module-less reflection/string-parse path `findTypeByName`→`getTypeFromString`→`parseTermFromSourceFile`):
- PR guarded 5 sites (`_parseSimpleTypeSpec` leading-`::` scope deref + 4 `currentModule->languageVersion` reads) and added a null-tolerant `getCurrentLanguageVersion()` accessor.
- But `Parser::ParseStruct()` (`slang-parser.cpp:6384`/`:6389`) still read `currentModule->languageVersion` **unguarded**, and it is reachable on the *identical* path: `ParseExpression`→ `as`/`is` in `parseInfixExprWithPrecedence` → `ParseType` → `_parseSimpleTypeSpec` calls `ParseStruct()` on the `struct` keyword (two lines above the deref the PR *did* guard). `_parseAtomicTypeExpr` parses full decl syntax even with `allowDecl=false` (the `DeclNotAllowed` diagnostic fires only after `ParseStruct` returns), so the body runs. Repro: `findTypeByName("x as struct[X] Foo {}")` → after `as`, type grammar reads `struct` then `[` → `LookAheadToken(LBracket)` true → null deref. Raw segfault (not `SLANG_ASSERT`), so it escapes the `try/catch` in `spReflection_FindTypeByName` — the exact failure class #13015 claimed to close.
- Structural signal (clarity C001 raised it independently): with a consumer-guard approach, **nothing enforces** that a new `SLANG_LANGUAGE_VERSION_*` gate routes through the accessor rather than a raw `currentModule->` deref. Recommend the PR document the invariant "bare-deref sites are module-path-only" and include the grep-audit.

Cross-reviewer note: three independent sub-reviewers (security + code-quality + trace) converged on this, but **Devin (anonymous scrape) reported no findings / "low risk"** and its output largely mirrored the PR description (commit-status came back "unknown"). Reinforces: treat Devin as best-effort/corroborating, never gating; the local correctness pipeline is what caught the real bug. This is the same "the guard is one layer off / too narrow" pattern already in the wiki (front-end guard/cast bugs), now with a concrete reachable-class-audit technique.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789161922124-bundle-null-guard-fixes-grep-audit-the-whole-reach.md`_
