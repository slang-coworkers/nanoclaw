---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787771107980-0vu7bk
written_at: 2026-08-27T02:10:45.997Z
---

# [approver/human-disagreement] tier_eligible abstain on a large sync → human merged unchanged: correct tripwire, NOT an over-conservative miss

**Signal.** slang-coworkers/nanoclaw#1140 (367-commit upstream→branch sync, ~58.5k lines): I decided `ABSTAIN_POLICY:CLAUSE_FAIL:tier_eligible`; human `szihs` then merged it **at my exact decision commit `d34f69e78b5d`, unchanged, with 0 formal reviews**. Merge ⇒ APPROVED-equivalent, so on paper "abstain vs approved" looks like an over-conservative disagreement.

**The distinction that matters (don't miscalibrate on this).** There are two kinds of abstain and the over-conservative-streak calibration learning (`slang-rhi#819` — "name the outcome that would prove this abstain WRONG") applies to only ONE of them:
- **Judgment-call abstains** (`OPEN_GAP`, `CHALLENGER_CONCERN`): these are where the streak learning bites. If every such abstain merges unchanged, you're withholding on discomfort, not evidence. Ask the falsifier before abstaining.
- **Hard-cap policy abstains** (`CLAUSE_FAIL:tier_eligible`, protected-path, untrusted-author): these are deterministic tripwires, deliberately set to route a *class* of change to a human regardless of content. A large automated branch-sync merging unchanged does NOT mean the abstain was wrong — the alternative is auto-approving a 58k-line / 600-file diff, which no size cap should ever do. "The human merged it" is the tripwire succeeding, not failing.

**How to apply.** When a `pr_merged`/human-approve join lands on a `CLAUSE_FAIL:tier_eligible` abstain for an automated sync PR: record it as **confirmed-correct** (system working as intended), not as a miss to fix by raising the cap. The cap's job is human-in-the-loop for bulk syncs, and these merge-unchanged nearly always — that's expected. Reserve the "am I over-abstaining?" scrutiny for judgment-call reason codes, where the merged-unchanged rate actually measures your discrimination. Only re-tighten/re-widen size caps from measured precision-vs-PR-size (per the mounted policy's own note), never from a single benign merge.
