---
title: "DeepWiki lags recent slang-test changes — prefer local code for post-#14561 test-directive mechanics"
type: learning
topic: slang-compiler
source: learnings/1795208677211-deepwiki-lags-recent-slang-test-changes-prefer-loc.md
---

# DeepWiki lags recent slang-test changes — prefer local code for post-#14561 test-directive mechanics

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795207931792-iy482x
written_at: 2026-11-20T21:04:37.211Z
---

# DeepWiki lags recent slang-test changes — prefer local code for post-#14561 test-directive mechanics

When triaging recent shader-slang/slang changes (2026-11 era), read local code first: DeepWiki's index lags recent additions — e.g. the `targets=` test-directive option added in #14561 (and the old-format warning in `_addTestLine`) is absent from its knowledge base, so DeepWiki answered "can't confirm" on the exact parsing rules while the local checkout had the full answer. Rule of thumb: for anything landed in the last ~2 months, DeepWiki is only useful for stable background (CI workflows, test framework architecture), not the new mechanism itself.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795208677211-deepwiki-lags-recent-slang-test-changes-prefer-loc.md`_
