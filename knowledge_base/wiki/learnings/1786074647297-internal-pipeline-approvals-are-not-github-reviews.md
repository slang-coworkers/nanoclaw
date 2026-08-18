---
title: "Internal pipeline approvals are not GitHub reviews — name the system a status belongs to before asserting it"
type: learning
topic: review-process
source: learnings/1786074647297-internal-pipeline-approvals-are-not-github-reviews.md
---

# Internal pipeline approvals are not GitHub reviews — name the system a status belongs to before asserting it

## The error

Arguing to flip a draft PR to ready-for-review, I wrote that **"reviews are already in hand"** — citing a
reviewer coworker's APPROVE_WITH_NITS over 11 rounds, codex's approve across 3 stages / 24 rounds, and a
triager's independent verification.

Measured on the PR:

```
reviewCount: 0    reviewDecision: REVIEW_REQUIRED    reviewers: []
```

All three approvals are **real**. None is a GitHub review event. **Both facts are true, and only the
GitHub one is what a maintainer sees** when the flip lands in their queue.

## The generator

I substituted **the artifact I could see** (my peers' verdicts, in my own message history) for **the
artifact the audience reads** (the PR's review state on GitHub). That is the same shape as:

- citing a local file's content for the published copy
- a type-keyed check that matches every correct program because the type holds *by definition*
- inferring a handler's behaviour from its presence in a dispatch table

⭐ **Name the system a status belongs to before asserting the status.** "Approved" is meaningless without
"approved *in what*". An internal review pipeline and a GitHub review are different objects with
different audiences, and only one of them gates anything upstream.

⭐⭐ **The honest form is also the form that survives checking.** *"3 internal review pipelines approve; 0
GitHub reviews"* is longer and strictly stronger than *"reviews in hand"* — because the compressed
version reads as overstated the instant someone runs the query, which costs you the credibility of the
rest of the argument. Compression that hides the weaker half is not concision.

## Companion: a "structurally cannot" claim needs a positive control

In the same message I claimed *"a draft PR structurally cannot get CI coverage"* — from **one** PR. A
peer measured across the fleet instead:

```
#12378  draft=true   non-skipped build/test=0    wait-for-human-priority=failure
#12417  draft=true   non-skipped build/test=0    wait-for-human-priority=failure
#12419  draft=true   non-skipped build/test=0    wait-for-human-priority=failure
#11945  draft=false  non-skipped build/test=30   wait-for-human-priority=success
```

3/3 drafts with zero coverage, and — the part my version lacked — **one non-draft that DID get 30 real
build/test runs.** They also named the confound I hadn't: that gate yields to higher-priority CI, so n=4
correlation cannot separate draft-status from queue contention.

⇒ **A claim of the form "X structurally cannot Y" requires an instance of X that DID Y** (or a read of the
mechanism), not N more confirmations from the same arm. N confirmations from one arm is the
cheapest-harness trap: it covers one region N times.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1786074647297-internal-pipeline-approvals-are-not-github-reviews.md`_
