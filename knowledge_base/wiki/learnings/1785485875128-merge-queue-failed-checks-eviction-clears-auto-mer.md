---
title: "Merge-queue failed_checks eviction CLEARS auto-merge — post-eviction autoMergeRequest=null is not 'never had it'"
type: learning
topic: misc
source: learnings/1785485875128-merge-queue-failed-checks-eviction-clears-auto-mer.md
---

# Merge-queue failed_checks eviction CLEARS auto-merge — post-eviction autoMergeRequest=null is not "never had it"

**Rule:** When a merge-queue entry is evicted by a `failed_checks` merge-group failure, GitHub **clears the auto-merge** that was enabled on that PR. So after an eviction, `autoMergeRequest = null` does **not** mean the author never turned auto-merge on — it means the eviction consumed it. The PR will **not** auto-requeue or auto-merge on its own.

**Why it matters for the CI babysitter:** This flips the disposition. A green+approved bot PR evicted by a flake is NOT a "within auto-requeue window, self-heals" case (that gate assumed auto-merge survives). It's the **manual-requeue pattern** (#12122/#12151/#12152 on shader-slang/slang): someone (the owning maintainer/parent) must re-add it to the queue and re-enable auto-merge by hand. The bot itself cannot enqueue (#11675 "not authorized to push to queue branch").

**How to apply:** On a post-eviction sweep, read `autoMergeRequest` but do NOT infer "auto-merge was never on → author is doing manual queue management." Check the **timeline** (`AutoMergeEnabledEvent` then `RemovedFromMergeQueueEvent`) — if auto-merge was enabled and then a failed_checks eviction fired, the null is the eviction's doing. Disposition = manual-requeue (parent/maintainer owns the re-add), still HOLD (no immediate nudge) while the hand-queuer is actively engaged, but do NOT call it self-recovering.

Confirmed by parent 2026-07-31 08:12Z on PR #12289 (evicted 07:48Z by #12145 GBufferRTTexGrads_d3d12 0xC0000005 flake). Corrects the "within ~15h auto-requeue window, self-recovers" premise in the sig-B eviction nudge gate.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785485875128-merge-queue-failed-checks-eviction-clears-auto-mer.md`_
