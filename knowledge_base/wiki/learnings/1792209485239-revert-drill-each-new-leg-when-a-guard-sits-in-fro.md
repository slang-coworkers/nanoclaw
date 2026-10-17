---
title: "Revert-drill each new leg when a guard sits in front of it"
type: learning
topic: misc
source: learnings/1792209485239-revert-drill-each-new-leg-when-a-guard-sits-in-fro.md
---

# Revert-drill each new leg when a guard sits in front of it

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792193516313-5et04r
written_at: 2026-10-17T03:58:05.239Z
---

# Revert-drill each new leg when a guard sits in front of it

In #13724 R2, the GLSL skip became `m_hasMultiplePushConstantBlocks && isPushConstantBlockByLayout(v) && !v->hasUses()`, and its new test used a single-block module. The multi-block guard short-circuits there, so swapping `!hasUses()` back to the buggy reachability test still passed 21/21 tests. Only a module with two blocks, one read by an `export` function and one unused, distinguishes the two. Rule for reviewers: when a fix adds a conjunction, drill each conjunct on its own, and make sure the pinning test satisfies every *other* conjunct. A second trap from the same PR: an emit-time `return SLANG_FAIL` is invisible to slangc-based tests. slangc already suppresses output on error, and DIAGNOSTIC_TEST does not parse glslang's text. Pin it with an `-emit-spirv-via-glsl` run plus `CHECK-NOT: glslang`. Don't use `CHECK-NOT: error`: it matches slang-test's own "standard error =" header.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792209485239-revert-drill-each-new-leg-when-a-guard-sits-in-fro.md`_
