---
title: "[approver/procedure] A stale webhook dispatch on an already-joined PR is a no-op + report, never a re-decision — record_decision is idempotent and will clobber the join"
type: learning
topic: agent-ops
source: learnings/1785841360069-approver-procedure-a-stale-webhook-dispatch-on-an-.md
---

# [approver/procedure] A stale webhook dispatch on an already-joined PR is a no-op + report, never a re-decision — record_decision is idempotent and will clobber the join

# A stale dispatch is a CLAIM about state, not state — resolve live and grep your own store BEFORE staging

## Symptom
A `[PR-APPROVE]` dispatch for shader-slang/slang#12142 (reason `synchronize`) was delivered **2026-08-04** but
timestamped **Jul 17** — ~18 days stale. The PR had been **MERGED since 2026-07-29**, and I had **already decided
it on 07-19 at the exact same head** (`2a61c227a2ca`), with the human verdict already stamped
(kaizhangNV APPROVED review 4812124952, `commit_id == head`).

Walking the workflow literally — stage → harvest → Devin → synthesize → decide — would have produced a **second
decision on an already-joined row**.

## Why that is actively harmful, not merely wasted work
`record_decision` is **idempotent per `(repo, pr, commit_sha)`** — a re-run on the same commit *replaces* the row.
So re-deciding would have:
1. **Overwritten a terminal, human-joined calibration datapoint** — the join is the product; the decision alone is
   worthless without it.
2. Done so with a verdict **contaminated by post-hoc information** that did not exist at decision time. On this PR
   the fork CI gate released on 07-23 (4 days *after* my abstain), so a fresh decision would have "seen" green CI
   and plausibly returned WOULD_APPROVE — silently converting a *correct conservative abstain* into a fake
   agreement, and destroying the evidence that the abstain was directionally right.
3. Burned a full harvest + Devin browser run for zero information.

## Root cause
I treated the dispatch's contents as state. **A dispatch is a claim about state at the time it was emitted.**
Webhook delivery can lag arbitrarily (parked/debounced PRs, host `APPROVER_CI_GATE` re-wakes, replayed queues), and
the tasking message carries no freshness guarantee.

## How to catch it — 2 API calls, before staging anything
```bash
gh pr view <pr> --repo <repo> --json state,isDraft,headRefOid,mergedAt   # live state
ls -d work/<pr>-*                                                        # my own prior workspaces
grep -rn "<pr>" <memory-dir>/                                            # my own prior rows
```
Then branch:
- **`state=MERGED`/`CLOSED` AND a row exists at that same head** ⇒ **no-op.** Report the existing decision +
  its join. Do not re-stage, re-harvest, or re-record.
- **Row exists at the same head, PR still open** ⇒ no new decision; the head has not moved, so nothing to decide.
- **Head has MOVED** ⇒ that is a genuinely new revision: decide it as `live_late` with a full re-gate.
- **No row** ⇒ normal path.

Cheap tell that this is worth checking every time: the dispatch timestamp vs `date -u`. Any gap of more than a few
hours means re-resolve everything.

## Generalization
This is the same failure family as scoring a join off a stale SHA: **never let a relayed fact stand in for a live
read of the thing it describes.** The corollary that bit hardest here is that the *destructive* operation
(idempotent overwrite) looks identical in the tool surface to the *constructive* one (first record) — so the guard
has to live upstream, in the decision to stage at all.

Cost of the check: 2 API calls. Cost of skipping it: one destroyed calibration row, unrecoverable.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785841360069-approver-procedure-a-stale-webhook-dispatch-on-an-.md`_
