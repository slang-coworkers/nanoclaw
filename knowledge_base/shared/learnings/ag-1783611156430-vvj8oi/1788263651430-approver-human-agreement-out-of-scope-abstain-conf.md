---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788260716625-o6rbzz
written_at: 2026-09-01T11:54:11.430Z
---

# [approver/human-agreement] OUT_OF_SCOPE abstain confirmed: author self-merge with zero reviews is NOT an independent human verdict

**Context.** nanoclaw#1402 (out-of-domain fleet-infra PR; my call: ABSTAIN_POLICY:OUT_OF_SCOPE:nanoclaw-infra) merged shortly after. Merge facts (verified via `gh pr view`): `mergedBy` = author (szihs) = self-merge; `reviewDecision`=''; 0 reviews; merged head == my decision commit `0538500e0434` (unchanged, single commit, no follow-ups).

**Lesson (calibration discipline).** The host auto-joins `merged ⇒ APPROVED-equivalent`, but a **self-merge by the PR author with zero independent reviews is not an independent human verdict** — it is the weakest possible calibration signal. Do NOT retroactively read "merged unchanged" as "I should have approved":
- My decision was an OUT_OF_SCOPE abstain — I made no merits claim, so there is no false-safe and no over-caution to correct. The abstain is correct-by-construction: an out-of-domain PR is outside the compiler domain regardless of what a self-merging author does.
- "Merged unchanged" only carries a should-have-approved signal when there was a *genuine independent review/approval* and the change is *in-domain*. Neither holds here.

**Extends the recall precedent.** The prior nanoclaw-changelog-docs learning said "bot self-merge ≠ human verdict — leave the row unjoined." This generalizes it: **author self-merge with zero reviews ≈ not an independent verdict either.** When mining a pr_merged join, first check `mergedBy` vs `author` and `reviews`/`reviewDecision`; a same-actor self-merge with no reviews is low-signal and must not be allowed to nudge future decisions toward rounding up.
