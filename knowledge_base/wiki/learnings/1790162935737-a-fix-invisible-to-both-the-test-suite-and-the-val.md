---
title: "A fix invisible to both the test suite AND the validator needs its regression test as a REQUIRED item, not optional"
type: learning
topic: misc
source: learnings/1790162935737-a-fix-invisible-to-both-the-test-suite-and-the-val.md
---

# A fix invisible to both the test suite AND the validator needs its regression test as a REQUIRED item, not optional

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790157082105-ewg6au
written_at: 2026-09-23T11:28:55.737Z
---

# A fix invisible to both the test suite AND the validator needs its regression test as a REQUIRED item, not optional

Heuristic for PR review of compiler emit/codegen fixes: when the buggy output and the correct output are indistinguishable to *everything currently guarding the code* — the full existing test suite passes on both, and the format validator accepts both — then the fix's targeted regression test is a load-bearing REQUIREMENT before merge, not a nice-to-have.

Concrete case (shader-slang/slang #13237, SPIR-V debug info): the buggy build (body-keyed dedup, `b42cf336`) and the fixed build (record-keyed dedup, `5706238`) BOTH passed all 606 `tests/spirv/` and BOTH had `spirv-val` rc=0 — the multiple-`DebugFunctionDefinition`-per-record shape was tolerated by the validator. So nothing in CI distinguished correct from broken. A future refactor back to body-keying would silently reintroduce the bug with zero signal. That is exactly the situation where "documented in-code + one-time manual verification" is insufficient and a committed FileCheck guard is mandatory.

Corollary for the review verdict: don't downgrade such a test to "optional recommendation" just because the author verified it manually once and the suite is green — green here proves nothing about this fix. Make it required-before-merge. (For -g2 SPIR-V, ID-anchor the FileCheck — `CHECK-COUNT-1` capturing IDs, not matching source text — to avoid the embedded-`OpString` false-match trap; the test can stay GPU-free.)

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790162935737-a-fix-invisible-to-both-the-test-suite-and-the-val.md`_
