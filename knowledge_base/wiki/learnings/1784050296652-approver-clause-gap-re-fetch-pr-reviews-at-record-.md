---
title: "[approver/clause-gap] re-fetch PR reviews at record time, not just at staging — a human verdict can land during the harvest+Devin window (confirmed live on #11987 R2)"
type: learning
topic: review-approval
source: learnings/1784050296652-approver-clause-gap-re-fetch-pr-reviews-at-record-.md
---

# [approver/clause-gap] re-fetch PR reviews at record time, not just at staging — a human verdict can land during the harvest+Devin window (confirmed live on #11987 R2)

## Symptom
On #11987 revision R2 (@5b16405c3279), my staging-time review check (~17:15Z,
during Step 1a) saw only COMMENTED/DISMISSED human reviews. `jkwak-work` then
submitted an **APPROVED** review on that exact pinned SHA at 17:17:54Z — inside
my harvest+Devin+challenger window — and my decision at 17:20:21Z. My
`decision-message.md` said "Await human verdict join" and `investigation.md`
claimed "none is a live APPROVE"; both were stale by the time I recorded. The
OUTPUT_REVIEW critique gate caught it (2 must-fixes) — my own procedure did not.

## Root cause
The workflow fetches reviews once, at staging (Step 1a, to set `mode`). The
harvest + Devin run can take several minutes; a maintainer reviewing in real
time can APPROVE/CHANGES_REQUESTED the pinned head in that gap. Nothing in the
scripted steps re-reads review state before `record_decision` +
`record_human_verdict`, so the recorded human-join framing reflects a snapshot
that may be minutes stale.

## How to catch it
Immediately before recording (right before assembling decision.json /
decision-message.md), re-run:
`gh pr view <pr> --repo <repo> --json reviews --jq '[.reviews[] | select(.commit.oid=="<pinned_sha>")]'`
and check for any APPROVED / CHANGES_REQUESTED on the PINNED head. If present:
(a) it does NOT change your independent decision — it's a separate join signal;
(b) call `record_human_verdict` with it (agreement or disagreement); (c) make the
message's next-action say "recorded" not "awaited"; (d) if it's
CHANGES_REQUESTED and you decided WOULD_APPROVE, that's a live false-safe —
`[approver/false-safe]` with the missed evidence. This is the same clause-gap as
the prior `[approver/clause-gap] re-check PR reviews before finalizing mode`
learning, but the miss here was the human-JOIN framing, not `mode` (mode was
already correctly live_late).

## Fix
Treat "re-fetch reviews on the pinned SHA at record time" as a mandatory
pre-record step, not just staging. Until the workflow bakes it in, the
OUTPUT_REVIEW gate is the backstop — it independently checks live review state,
which is why it caught this. Recurring adjacent advisory across runs: persist the
`harvest-reviews.py` exit code into `harvest.json` (currently only `{"found":
false}` on exit 20), so OUTPUT_REVIEW can verify the tier without run history.

## Outcome
#11987 R2: WOULD_APPROVE/CLEAN, human jkwak-work APPROVED same SHA → agreement
recorded, no false-safe. Both maintainers ultimately approved (pdeayton prior
SHA, jkwak head). Bot shadow call matched human judgment on both revisions.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784050296652-approver-clause-gap-re-fetch-pr-reviews-at-record-.md`_
