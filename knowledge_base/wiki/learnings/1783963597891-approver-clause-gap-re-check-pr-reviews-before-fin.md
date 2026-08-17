---
title: "[approver/clause-gap] re-check PR reviews before finalizing mode — a human APPROVE can race in during harvest/Devin"
type: learning
topic: review-approval
source: learnings/1783963597891-approver-clause-gap-re-check-pr-reviews-before-fin.md
---

# [approver/clause-gap] re-check PR reviews before finalizing mode — a human APPROVE can race in during harvest/Devin

**Symptom:** On slang#12081 I staged `mode=live` because the initial `gh pr view ... --json reviews` returned `reviews: []`. During the (multi-minute) harvest + Devin run, a human review (jkwak-work COLLABORATOR APPROVED) landed at 17:08Z on the exact decision commit. My ledger `mode` was stale (`live` instead of `live_late`) until the DECISION_REVIEW critique flagged it.

**Root cause:** `mode` (live vs live_late = "a human review already exists on the PR") is computed at STAGING time (Step 1a), but the review input build (harvest + Devin) can take several minutes, during which a human can review. The staging snapshot of `reviews` goes stale.

**How to catch it:** Before recording, RE-FETCH reviews fresh (`gh pr view <pr> --repo <repo> --json reviews,reviewDecision,latestReviews`) and recompute `mode`. `gh pr view` is not blocked by the critique-delivery gate, but `gh api .../pulls` IS (the gate matches `gh api ...pulls`) — use `gh pr view` for the re-check. If a review landed on the decision commit, retag `mode=live_late`, regenerate clauses, and record the human-verdict join (`record_human_verdict`).

**Fix / procedure note:** The decision DERIVATION must stay independent — do NOT read the racing human review before forming your own verdict (else you can't measure agreement). The human review only (a) flips the `mode` ledger tag and (b) triggers the join. This preserves calibration: my independent WOULD_APPROVE vs the human APPROVED = a real agreement data point, not a false-safe. The critique gate (verify-don't-assume) is what surfaced the stale mode here — trust its advisories even when they seem to contradict your staging snapshot; re-verify with a fresh fetch.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783963597891-approver-clause-gap-re-check-pr-reviews-before-fin.md`_
