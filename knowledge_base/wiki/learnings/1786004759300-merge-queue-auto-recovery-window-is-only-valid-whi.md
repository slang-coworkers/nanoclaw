---
title: "Merge-queue 'auto-recovery window' is only valid while auto-merge survives the eviction"
type: learning
topic: misc
source: learnings/1786004759300-merge-queue-auto-recovery-window-is-only-valid-whi.md
---

# Merge-queue "auto-recovery window" is only valid while auto-merge survives the eviction

## The rule

Before framing an evicted PR as "holding inside the auto-recovery window", verify auto-merge is **still enabled**. A `failed_checks` merge-group eviction **consumes** the auto-merge that was on. Post-eviction `autoMergeRequest == null` means *the eviction cleared it*, not that it was never set — and with it gone, **nothing will auto-requeue**. The wait is not a recovery window; it is dead time, and when the clock runs out the required action is a **manual re-add request** to whoever enabled auto-merge.

## Why this is easy to get wrong even with the right data

Observed on shader-slang/slang #12309 (2026-08-06, bot-authored, evicted 05:53:28Z by a `VK_ERROR_DEVICE_LOST` cascade). I queried the timeline and had both halves on screen:

```
AutoMergeEnabledEvent      2026-08-06T01:39:17Z  jkwak-work
RemovedFromMergeQueueEvent 2026-08-06T05:53:28Z  failed_checks
autoMergeRequest = NULL     mergeQueueEntry = NULL
```

…and still reported "holding inside the ~15h auto-recovery window." The *hold* decision was correct (don't nudge on the first sweep), so the wrong frame caused no wrong action **that sweep** — which is exactly why it would bite later. A bar labelled "auto-recovery" invites the next sweep to note "still not recovered" and keep waiting; a bar labelled "manual re-add owed" forces an act. **A benign-now mislabel is a scheduled failure: the frame is what the future reader executes.**

## Disposition table

Print all three fields and let them choose:

```bash
gh api graphql -f query='{repository(owner:"OWNER",name:"REPO"){pullRequest(number:N){
  autoMergeRequest{enabledBy{login}} mergeQueueEntry{state}
  timelineItems(last:20,itemTypes:[AUTO_MERGE_ENABLED_EVENT,REMOVED_FROM_MERGE_QUEUE_EVENT]){
    nodes{__typename ... on AutoMergeEnabledEvent{createdAt enabler{login}}
          ... on RemovedFromMergeQueueEvent{createdAt reason}}}}}}'
```

- `mergeQueueEntry != null` → already back in the queue, eviction self-resolved → **no action**.
- `autoMergeRequest != null` → auto-merge survived → **genuine** auto-recovery window, hold.
- `autoMergeRequest == null` **and** an `AutoMergeEnabledEvent` precedes a `failed_checks` removal → **cleared by the eviction** → the clock is a deadline for a **manual re-add request**, addressed to the `enabler`. Never call this auto-recovery.

Do **not** infer disposition from the elapsed gap — the discriminator is the auto-merge state and the `enqueuer`/`actor`, never the time delta.

## Operational note

Record the corrected disposition **in the durable per-PR ledger entry**, not only in a status message. A note in a sent message does not survive the session; the next sweep reads the ledger, and that is what stops the bar from passing silently.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786004759300-merge-queue-auto-recovery-window-is-only-valid-whi.md`_
