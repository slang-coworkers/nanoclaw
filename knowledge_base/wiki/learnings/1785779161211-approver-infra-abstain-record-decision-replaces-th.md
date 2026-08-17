---
title: "[approver/infra-abstain] record_decision replaces the row and DROPS any record_human_verdict stamp — re-stamp after any correction"
type: learning
topic: review-approval
source: learnings/1785779161211-approver-infra-abstain-record-decision-replaces-th.md
---

# [approver/infra-abstain] record_decision replaces the row and DROPS any record_human_verdict stamp — re-stamp after any correction

# `record_decision` replaces the row — a `record_human_verdict` stamp on that row is collateral

## Symptom

Re-recording an approver row to correct its *input signal* (decision unchanged)
silently destroys the human-verdict stamp that agreement scoring depends on. The
row still looks fine — right decision, right reason_code — but the
`human_verdict` column is now empty, so the row drops out of accuracy
measurement entirely. Nothing errors.

## Root cause

`record_decision` is documented as "one row per (repo, pr, commit_sha) — a
re-run on the same commit **replaces** it." `record_human_verdict` "stamps the
human review outcome onto an **existing** row" — it is a separate write to that
same row. Replace the row and the stamp goes with it. The two tools have no
knowledge of each other.

Hit during the 2026-08-03 CodeRabbit under-read audit: slangpy#1085 @
`a1da5beac5af` carried `human_verdict=APPROVED`. Correcting the row's recorded
signal would have clobbered it — the disagreement datapoint (human APPROVED vs
approver ABSTAIN_POLICY) is precisely what the scoring exists to capture.

## How to catch it

Before re-recording ANY historical row, grep the session transcripts for
`record_human_verdict` against that repo/pr/**commit_sha** — the stamp is
per-commit, so a stamp on a sibling revision is not yours to preserve and not
yours to worry about. On slangpy#1063 the only 1063 stamp was for a different
revision (`06912033bb49`), so that correction was risk-free.

Sequence a batch so the unstamped row goes first: you learn the tool's actual
behavior on the row where a mistake costs nothing.

## Fix

Re-stamp immediately after the replacement, in the same turn — do not defer it
to a later step that a context compaction or an error could eat:

```
record_decision({... corrected row ...})
record_human_verdict({repo, pr_number, commit_sha, human_verdict})  # restore
```

Also record the human verdict inside the correction note itself (I put it in
`clauses.signal_correction_*.decision_impact`), so the provenance survives even
if the stamp is lost again — a corrected row that reads "human APPROVED, we
abstained" is auditable on its own.

Candidate host-side fix, worth routing rather than working around: have
`record_decision` preserve an existing `human_verdict` on replace, or expose an
update path that doesn't require a full row rewrite.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785779161211-approver-infra-abstain-record-decision-replaces-th.md`_
