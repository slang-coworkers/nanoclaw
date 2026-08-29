---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787867970491-5ou9sf
written_at: 2026-08-28T23:34:52.745Z
---

# [approver/infra-abstain][approver/human-disagreement] #12537: human APPROVED at the exact commit I abstained (NO_REVIEW_SIGNAL) — infra abstain confirmed harmless, and the comment-hygiene must-fix was not shared by the area-owning maintainer

## Context
shader-slang/slang #12537 (Fix #12532, OptiX inout payload double-read). I recorded ABSTAIN_POLICY / NO_REVIEW_SIGNAL at head `a3e6cbd07164` (R2). ~22h later, `jkwak-work` — the maintainer who owns the CUDA/OptiX varying-param legalizer and had been driving the review — APPROVED that EXACT commit ("Looks good to me"), head unchanged, with no new push. The webhook join is host-side automatic (`record_human_verdict` is deliberately not container-callable, `/app/src/mcp-tools/core.ts:608`), so no manual join.

## What the human verdict calibrates

### 1. The NO_REVIEW_SIGNAL abstain was infra-driven and confirmed HARMLESS
My abstain was NOT a code concern — it was "no head-current automated review signal exists" (harvest exit 20 on a bot-authored PR + Devin returned head-stale cached analysis). ABSTAIN correctly means "a human must look." A human looked and approved the same bytes. So the abstain did its job (it did not falsely approve, and it did not falsely block), but the underlying cause was a PIPELINE gap, not a real risk in the change. Lesson: NO_REVIEW_SIGNAL abstains are the infra-gate burn-down target — the fix is making Devin head-current on rapidly-re-pushed PRs (see the sibling learning on devin-fetch staleness), not changing my decision rule. When the code is in fact fine, a NO_REVIEW_SIGNAL abstain is a pure cost of the missing signal.

### 2. The comment-hygiene must-fix was NOT shared by the area-owning maintainer
Across R1 and R2, the critique gate (codex) held a hard must-fix on the regression test's comment narrating the prior bug ("Previously… 8 optixGetPayload… the bug produced 8 reads", lines :9/:11/:62) as change-history narration. I flagged it as an independent approval prerequisite. But jkwak-work — who left multiple other style/naming nits on THIS PR (simplify a source comment, rename the helper to add "Already") and clearly cares about comment quality here — read the full diff and APPROVED with that test comment untouched. Two independent maintainer review passes did not object to it.
Transferable signal: for a REGRESSION TEST, a comment explaining the specific past bug it guards is treated by slang maintainers as legitimate context, not prohibited change-history narration — consistent with the pervasive "Regression test for #NNNN … previously X was broken" convention in `tests/`. The internal comment-hygiene rubric is stricter on this than the humans are. This does NOT mean ignore the gate (an approver cannot override a held critique and I correctly abstained), but it flags a likely RUBRIC-vs-practice gap worth raising with the skill owner: consider a regression-test carve-out for a comment that states the guarded bug, so the approver isn't forced to abstain on PRs maintainers consider clean. Recurring (2 revisions) ⇒ candidate procedure bug, per Step-4 `[approver/critique-mustfix]`.

## Meta
Scored against the falsifiable reading ("material enough not to merge as-is"): a clean maintainer approval at my exact decided head REFUTES that framing for both flagged items — neither was material enough to stop the owner from merging as-is. Kept honest by not excluding this abstain from the join (per the standing rule that an overruled abstain IS the false-abstain signal).
