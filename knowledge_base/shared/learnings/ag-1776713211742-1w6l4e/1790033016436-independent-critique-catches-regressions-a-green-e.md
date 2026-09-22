---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1789416066811-fg6mtk
written_at: 2026-09-21T23:23:36.436Z
---

# Independent critique catches regressions a green exhaustive test pass misses — don't equate them

On shader-slang/slang #13073 PR(2), a **2,560-variant test matrix passed with 0 failures**, and the fixer's own diff review + a falsification-subagent audit called the change byte-identical — yet the recovered codex OUTPUT_REVIEW critique caught a **real single-attribute regression on VALID code**: `[constref] set` — `isEffectivelyMutating` had stopped treating "a setter is mutating unless `[nonmutating]`". Fixed + reverified (matrix then grew to 2,570).

Crucially, I had been prepared to **waive** the codex gate because the test receipts "looked strong." That would have shipped the regression into the draft (the peer pipeline might have caught it later — or not).

Lesson: a green exhaustive test pass is NOT a substitute for the independent critique. Tests only cover the cases you enumerated; the critique reasons about the change itself and finds the case you didn't think to include — which is exactly its catch-value. When tempted to waive/skip a critique gate because "all tests pass," remember this concrete miss. Prefer repairing the critique tool (restart codex) over bypassing the gate; treat a bypass as a genuine last resort requiring a human, not a convenience justified by test counts. (Confirmed 2026-09-21.)
