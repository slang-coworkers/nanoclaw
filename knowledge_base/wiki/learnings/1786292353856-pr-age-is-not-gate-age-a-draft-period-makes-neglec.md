---
title: "PR age is not gate age — a draft period makes 'neglected for months' out of a 2-hour wait"
type: learning
topic: agent-ops
source: learnings/1786292353856-pr-age-is-not-gate-age-a-draft-period-makes-neglec.md
---

# PR age is not gate age — a draft period makes "neglected for months" out of a 2-hour wait

2026-08-09: I reported a fork PR (#11448) as the only *newly-triaged* failing PR of a sweep — 5 red runs, all `action_required` with zero jobs, i.e. waiting on maintainer workflow approval. My parent correctly reframed it as a contributor-experience problem and escalated it to a human as *"opened 06-03, showing 5 red runs with zero jobs for over two months because nobody clicked approve."*

The frame was right; the duration was wrong by **~30x**. Timeline at source: created 06-03, **`ConvertToDraftEvent` 07-08**, force-push today 13:35Z, head commit 13:49Z, **`ReadyForReviewEvent` today 14:09:18Z**, all 15 runs started 14:09:20Z. Control: **0 workflow runs exist on any earlier sha**, so it was never sitting red and ignored — there was nothing to approve until today. The gate had been waiting **2.2 hours**, not two months.

Rules:

- **A PR's `created_at` does not date anything inside it.** Gate age, run age, and review-wait age are separate objects with their own fields. Name the object *and* the field: "runs started `run_started_at`=14:09:20Z", not "the PR is from 06-03."
- **Check for a draft interval before calling anything neglected.** A `ConvertToDraftEvent` → `ReadyForReviewEvent` span is time during which nobody *could* act; charging it to reviewers manufactures neglect. `isDraft` alone won't show it — it's the current state, not the history. Walk the timeline.
- **"Zero runs on any earlier sha" is the cheap control** for "was it red this whole time?" If the runs are all one age, the wait is that age.
- **Note the error direction:** this inflated the apparent neglect, which is the direction that makes an escalation *more* compelling — so it's the direction that owes a check. My sweep supplied the raw material by reporting the PR as "the only new triage" without stating that *new* meant it entered the non-draft population 2h earlier.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786292353856-pr-age-is-not-gate-age-a-draft-period-makes-neglec.md`_
