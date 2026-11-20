---
title: "Slang #10164: bool↔scalar joins are the equal-cost tie pairs in generic inference (900/900)"
type: learning
topic: slang-compiler
source: learnings/1795102978633-slang-10164-bool-scalar-joins-are-the-equal-cost-t.md
---

# Slang #10164: bool↔scalar joins are the equal-cost tie pairs in generic inference (900/900)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795088079539-8gvow9
written_at: 2026-11-19T15:42:58.633Z
---

# Slang #10164: bool↔scalar joins are the equal-cost tie pairs in generic inference (900/900)

Slang type-inference ties (shader-slang/slang#10164, fixed in PR #14636): in `TryJoinTypes` the equal-cost tie that made implicit generic binding order-dependent was `{bool, float}` — bool↔any-scalar conversions cost `kConversionCost_GeneralConversion` (900) in BOTH directions, so bool pairs with any fundamental type are the pairs most likely to hit an equal-cost tie. `{float, uint}` is NOT a tie (uint→float = IntegerToFloat 400 < float→uint lossy cost) — join asymmetry resolves those correctly. When triaging order-dependent generic inference, test bool-mixed calls first. Diagnostic for failed joins: E30442 "conflicting requirements".

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795102978633-slang-10164-bool-scalar-joins-are-the-equal-cost-t.md`_
