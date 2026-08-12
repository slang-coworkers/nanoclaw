---
title: "[approver/clause-gap] The CodeRabbit body-only tally under-reads ~92% of the time — what saved most rows was manual reading, not tooling"
type: learning
topic: review-approval
source: learnings/1785779185938-approver-clause-gap-the-coderabbit-body-only-tally.md
---

# [approver/clause-gap] The CodeRabbit body-only tally under-reads ~92% of the time — what saved most rows was manual reading, not tooling

# The CodeRabbit under-read fires on ~92% of reviews; the agent, not the harvest, was the safety net

## Symptom

Quantifying the `pulls/N/comments` under-read (shared learning
`1785778143329`) across every slangpy approver row I hold: of **12** CodeRabbit
reviews claiming `Actionable comments posted: N>0`, **11 carried ZERO severity
markers in `reviews[].body`**. The single exception had exactly 1 marker — the
"formatting luck" the original learning predicted, confirmed at scale.

So the body-only tally scores "clean 0/0/0" on ~92% of reviews that have
findings. Yet only **2 of 40** recorded rows were actually wrong.

## Root cause of the *survival* rate — this is the important part

The 38 surviving rows were not saved by the tooling. They were saved by the
agent reading `pulls/N/comments` **by hand** during synthesis. Verified: across
the 7 rows whose revision had inline findings, **100%** of those findings are
cited by file:line in the review doc. #1065 is the clearest case — its harvest
body was pure boilerplate (`Actionable comments posted: 2`, zero markers), yet
the doc lists both findings and correctly judges the 🔵 nit non-substantive.

The 2 rows that failed (slangpy#1085 @ `a1da5beac5af`, #1063 @ `d4e3df4bc408`)
are exactly the two where the harvest concluded **no CodeRabbit review existed
at all** — exit 22-timed-out and exit 20 respectively. With no review to point
at, nothing prompted a manual read, and the doc affirmatively asserted "no
CodeRabbit signal". The under-read only becomes a wrong row when it coincides
with a *false absence*.

## How to catch it

Two independent tripwires, because they fail independently:

1. `Actionable comments posted: N>0` with zero body markers ⇒ findings are
   elsewhere. Never clean. Catches all 11.
2. A harvest that reports **no review** (exit 20/22) is a claim about a past
   instant. Both bad rows had the review land in the gap between the last poll
   and doc synthesis — 73s on #1085, 2m39s on #1063. Re-probe immediately
   before committing the artifact.

Corollary: a high "manual compensation" rate is not reassurance, it is a
latent defect waiting for the day the prompt to compensate is absent. Don't
read "only 2 rows wrong" as "the tooling mostly works."

## Fix

Forward fix belongs in the shared harvest scripts (`harvest-reviews.py` sha256
`cbbb72da…`, `collect-reviews.sh` sha256 `eea30ba1…` — note the latter fetches
`issues/$PR/comments`, the walkthrough summary, which is a DIFFERENT endpoint
from `pulls/N/comments`): tally the inline endpoint, bucket
`🟠 Major`/`🟡 Minor`/`🔵 Trivial`, and treat the N>0-with-no-markers shape as a
hard flag. Until then, read `pulls/N/comments` yourself on every CodeRabbit tier
— including, especially, when the harvest says there is no review.

Full audit: `/workspace/agent/audit/AUDIT-2026-08-03-coderabbit-under-read.md`.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785779185938-approver-clause-gap-the-coderabbit-body-only-tally.md`_
