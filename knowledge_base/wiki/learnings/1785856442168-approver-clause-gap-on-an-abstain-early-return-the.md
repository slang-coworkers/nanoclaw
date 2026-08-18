---
title: "[approver/clause-gap] on an ABSTAIN early return the critique gate is skipped — so the pre-record review re-fetch has NO backstop (3rd recurrence, slangpy#1084 rev-4)"
type: learning
topic: review-approval
source: learnings/1785856442168-approver-clause-gap-on-an-abstain-early-return-the.md
---

# [approver/clause-gap] on an ABSTAIN early return the critique gate is skipped — so the pre-record review re-fetch has NO backstop (3rd recurrence, slangpy#1084 rev-4)

## Symptom
slangpy#1084 rev-4: I decided ABSTAIN_POLICY:CLAUSE_FAIL:no_protected_paths at 22:28:21Z on `febe01ed4b4c`. A human maintainer review — **jkwak-work APPROVED, "Looks same to the others. LGTM"** — had landed on that same PR at **21:13:48Z, ~75 minutes BEFORE my decision**. I never surfaced it: my review-list read happened at staging, the protected-path clause short-circuited Step 1, and my report's next-action said "human maintainer review/merge" as if none had happened. The PR then merged 2026-08-04 at exactly my decision commit (no post-decision commits), so the abstain itself was conservative-correct — but the report was stale about the human state.

## Root cause — the new wrinkle
This is the **third live recurrence** of the known gap ([[approver-clause-gap-re-check-pr-reviews-before-finalizing-mode]], [[approver-clause-gap-re-fetch-pr-reviews-at-record-time-not-just-at-staging]]) — reviews are read once at staging (Step 1a for `mode`) and can go stale before recording. What's NEW: in **both prior cases the OUTPUT_REVIEW / DECISION_REVIEW critique gate caught it.** On an ABSTAIN the gate is deliberately skipped (skill Step 4.1 early return — abstains assert nothing about the code, so they're not critique-gated). **So on any ABSTAIN path the backstop that saved the two earlier runs does not exist.** Worse, a Step-1 clause FAIL short-circuits before verdict/challenger, removing even the incidental re-reads those steps would do. ABSTAIN paths are therefore the *most* exposed to this staleness, not the least — exactly inverted from where the safety net sits.

## How to catch it
Make the pre-record review re-fetch unconditional — **especially on the abstain/early-return path**, where nothing downstream will check for you:
`gh pr view <pr> --repo <repo> --json reviews` (NOT `gh api .../pulls` — the critique-gate Bash hook false-matches that; see [[approver-critique-gate-bash-hook-wrap-read-only-gh-api-pulls-calls-in-a-script-file]]).
Then: retag `mode` if it flipped; call `record_human_verdict` for any APPROVED/CHANGES_REQUESTED on the pinned head; and make the report's `next-action` say what the human state actually IS ("already approved by X, awaiting merge") rather than a generic "awaiting human review". A protected-path abstain whose next-action ignores an existing human approval reads as though the chain is earlier-stage than it is.

## Fix / calibration
The decision derivation still must stay independent — do not let the racing human review change your verdict; it only flips the ledger tag, triggers the join, and corrects the report's framing. Outcome here: 4× ABSTAIN_POLICY, two humans reviewed (ccummingsNV LGTM on an earlier head, jkwak-work APPROVED at head), author self-merged unchanged → merged ⇒ APPROVED-equivalent recorded on the rev-4 row. Conservative-correct agreement, no false-safe. Confirmed-safe class: **an all-`.github/**` thin-caller onboarding PR by a MEMBER, delegating to a same-org reusable workflow with `permissions: {}`, merges unchanged** — the abstain is the right call every time, but report the human state accurately while you wait.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785856442168-approver-clause-gap-on-an-abstain-early-return-the.md`_
