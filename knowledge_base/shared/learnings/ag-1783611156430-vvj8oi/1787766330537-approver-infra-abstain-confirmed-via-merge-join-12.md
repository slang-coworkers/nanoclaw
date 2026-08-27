---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787260895286-uafg6v
written_at: 2026-08-26T17:45:30.537Z
---

# [approver/infra-abstain] CONFIRMED via merge join: #12666 NO_REVIEW_SIGNAL abstain → human APPROVED (predicted infra false-negative, 0 code misses across 3 abstains)

**PR:** shader-slang/slang#12666 MERGED 2026-08-26T17:43Z by jkwak-work at `0861596adcf1` — exactly my R3 decision commit, no interval commits (verified vs live GitHub: squash-only repo, compared head.sha not ancestry). Clean join to my R3 row.

## Outcome vs my calls (calibration payoff)
Three decision rows on this PR, all ABSTAIN, and the merge join confirms **zero code misses**:
- **R3 ABSTAIN(NO_REVIEW_SIGNAL) → human APPROVED.** This is the infra false-negative I *explicitly predicted* in the R3 row. The code was sound (my own challenger cleared it: R1 gap closed, dedup source==file-dep source, core-leak cleared, negative-control test present) and two humans approved at head — but the machine review-INPUT tier was absent (Devin stale + no bot review on a bot-authored PR), so procedure required abstain. Merge confirms: the reason_code (missing signal), not the change, was the blocker.
- **R1 ABSTAIN(OPEN_GAP) → substantively correct.** A human requested changes at that commit; the standard-module-fallback gap was real and got fixed before merge.
- **R2 ABSTAIN(NO_REVIEW_SIGNAL)** — same infra class as R3.

## Transferable confirmations
1. **The infra-abstain taxonomy is calibrating correctly.** When a PR is code-clean (own challenger + human approvals) but abstained purely on NO_REVIEW_SIGNAL, predicting "this will join APPROVED as an infra false-negative" was right. This is the signal that separates the ~0-target infra abstains (tooling gaps to burn down) from policy abstains (working as intended) — and it's measurable at the reason_code level exactly as the skill intends.
2. **NOT rounding up to approve was still correct even though the outcome was APPROVE.** The merge validates the code, but it does NOT validate using human approval as decision input — the abstain kept the shadow-mode measurement honest (an independent row that the human outcome is scored against, not one that echoes it). A correct abstain that later joins APPROVED is not a "miss"; it's the infra gate doing its job while the code happens to be fine.
3. **The actionable burn-down remains the Devin-staleness gap** (already routed to the Devin-runner owner): every bot-authored `fix/issue-N` PR will keep forcing infra-abstains until devin-fetch pins/verifies the analyzed commit against the head. #12666 is the worked example — fixing that one gap would have let this decide positively three times.

Recording this as a positive confirmation (per skill Step 4: "if your call already matched the outcome, a short confirmed-note is still worth recording") — it closes the loop on the two earlier `[approver/infra-abstain]` learnings for this PR.
