---
title: "[approver/infra-abstain] A primary review that posts AFTER you decide (unchanged head) → refresh the row on the primary tier"
type: learning
topic: review-approval
source: learnings/1784723964060-approver-infra-abstain-a-primary-review-that-posts.md
---

# [approver/infra-abstain] A primary review that posts AFTER you decide (unchanged head) → refresh the row on the primary tier

**Symptom:** On PR #11667 the production "Claude PR Review" (github-actions[bot]) was still IN_PROGRESS when I recorded (Devin-only fallback tier, ABSTAIN_POLICY/CHALLENGER_CONCERN, 2026-07-14 13:12Z). It posted ~4 min later (13:16:50Z) at the EXACT pinned commit. My ledger row's blocker said "production review never posted at head" — which became factually false 4 minutes after I wrote it. It sat that way 8 days until a supervisor nudge.

**Root cause:** The exit-22 wait window (~6 min per poll) can expire just before a slow production review posts, especially on a fresh master-merge head where the review re-triggers and runs 30+ min. Deciding on the Devin-only fallback is correct at the time, but the decision record then encodes a transient infra state ("review never posted") as if permanent.

**How to catch it:** When a supervisor nudge or any later event lands on a PR you decided via the Devin-only/stale fallback, re-check live state FIRST: `gh pr view <pr> --json headRefOid,state,reviews`. If (a) the head is UNCHANGED (same commit you decided) and (b) a primary github-actions[bot] review now exists at that commit (harvest exit 0, not stale, and `diff_hash` matches your staged pr.diff) → the primary signal you lacked is now available for the SAME revision. Per the skill (one row per (pr, revision commit); `record_decision` replaces), REFRESH the row on the primary tier rather than leaving the fallback row with its stale blocker.

**Fix:** Re-harvested → primary review 🟡 "has issues, 2 gaps, no 🔴". Re-ran clauses (commit_match now passes on the primary review), re-ran the challenger (the primary independently VERIFIED my R1 Concern 2 correct, and its Gap #1 converged with my R1 Concern 1 on the same `findTargetOptionalType` function), re-passed the critique gate, and replaced the row: ABSTAIN_POLICY / CHALLENGER_CONCERN (devin-only) → ABSTAIN_POLICY / OPEN_GAP (primary), blocker corrected. Decision CLASS was unchanged, but the tier, reason_code, and blocker became accurate. Takeaway: a fallback-tier decision is provisional against a late primary review on an unchanged head — the refresh is cheap and keeps the ledger honest for calibration.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784723964060-approver-infra-abstain-a-primary-review-that-posts.md`_
