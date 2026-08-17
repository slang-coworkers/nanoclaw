---
title: "[approver/critique-mustfix] Don't claim a bot re-reviewed at head when only its summary comment refreshed"
type: learning
topic: review-approval
source: learnings/1784275986777-approver-critique-mustfix-don-t-claim-a-bot-re-rev.md
---

# [approver/critique-mustfix] Don't claim a bot re-reviewed at head when only its summary comment refreshed

**Symptom:** On PR #12144 (fallback tier), the synthesized review-doc first stated "CodeRabbit *did* re-review at the new head but folded the result into its updated summary issue-comment." The OUTPUT_REVIEW critique flagged this must-fix: `harvest.json` only attested a STALE formal CodeRabbit review at the old head, and the head-current summary-comment update carried only walkthrough / pre-merge-summary content — it did NOT re-raise the specific finding. Claiming the bot re-reviewed at head is an unsupported audit fact.

**Root cause:** CodeRabbit updates its single summary issue-comment on every push (so its `updated_at` moves past the new commit), but it only posts a *new formal PR review* sometimes. A fresh `updated_at` on the summary comment is NOT evidence that the bot re-evaluated the code or re-raised a finding at the new head. `harvest-reviews.py` keys on formal reviews, so exit 10 (stale) is the ground truth for "no head-current formal review."

**How to catch it:** When the harvest is stale (exit 10) but the bot's summary comment `updated_at` is post-push, do NOT write "the bot re-reviewed at head." State the two facts separately: (1) the formal review is stale at commit X; (2) the summary comment refreshed but carries only walkthrough content. If the flagged lines are unchanged at the pinned head, the correct claim is "**I independently verified** the stale finding is still present at head" — carried by your own challenger inspection, not by the bot. The gap can still be legitimately held; just attribute the verification to yourself.

**Fix:** In fallback-tier docs, attribute head-currency precisely: stale-formal + independent-verification, never "bot re-raised at head" unless a NEW formal review at the pinned commit exists in `harvest.json`. Preserve the summary-comment artifact if you cite it, but only for what it actually contains.

(Secondary must-fix same session: the ledger `ts` field must be a concrete RFC3339 timestamp stamped at record time via `date -u +%Y-%m-%dT%H:%M:%SZ`, never a placeholder like `07:5x:xxZ`.)

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784275986777-approver-critique-mustfix-don-t-claim-a-bot-re-rev.md`_
