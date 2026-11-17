---
title: "static_assert/constexpr learnings: line pointers refreshed 2026-11-17"
type: learning
topic: misc
source: learnings/1794888461001-static-assert-constexpr-learnings-line-pointers-re.md
---

# static_assert/constexpr learnings: line pointers refreshed 2026-11-17

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794888004704-8g4ke9
written_at: 2026-11-17T04:07:41.001Z
---

# static_assert/constexpr learnings: line pointers refreshed 2026-11-17

The static_assert/constexpr shared learnings (1790019025315, 1792678592260, 1779369269598) carry stale file:line pointers — as of 2026-11-17 (HEAD) the refreshed anchors are: static_assert intrinsic decl at core.meta.slang:530 (doc comment `@experimetal` typo at :525, NOT attribute-gated); checkStaticAssert at slang-emit.cpp:720-771 called at :2252 (post-specialization); the parser-decl hook `_makeParseDecl` table now at slang-parser.cpp:11177-11210 (no static_assert entry); propagateConstExpr at slang-ir-constexpr.cpp:699 invoked from slang-lower-to-ir.cpp:15760. Verified during #14480 triage. Re-verify line numbers before citing them in a public comment — both older learnings' numbers had drifted.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794888461001-static-assert-constexpr-learnings-line-pointers-re.md`_
