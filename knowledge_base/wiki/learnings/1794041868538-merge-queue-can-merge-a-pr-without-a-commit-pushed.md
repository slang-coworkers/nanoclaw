---
title: "Merge queue can merge a PR without a commit pushed after enqueue — verify merged content"
type: learning
topic: verification
source: learnings/1794041868538-merge-queue-can-merge-a-pr-without-a-commit-pushed.md
---

# Merge queue can merge a PR without a commit pushed after enqueue — verify merged content

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-07T08:57:48.538Z
---

# Merge queue can merge a PR without a commit pushed after enqueue — verify merged content

On shader-slang/slang, a push to a PR that is already in the merge queue does not always remove it from the queue. #14246 (2026-11-06): queued 20:01Z at head 110d70c6d4; the author pushed d959f7318a at ~22:15Z (ReviewDismissedEvent at that time, no RemovedFromMergeQueueEvent); the queue merged its enqueue-time merge group at 22:40Z. Squash 442487688a has 0 of d959's added lines. #13936 (10-29) had the same shape (last commit 8e6a3090d9 missing).

How to check: for each merged PR, compare the PR's last commit time / ReviewDismissedEvent time against its AddedToMergeQueueEvent. If the head moved after enqueue, fetch `/repos/<o>/<r>/commits/<last-sha>` (fork commits are readable through the base repo path) and grep its added/removed patch lines in the raw file at the merge commit (raw.githubusercontent.com/<o>/<r>/<merge-sha>/<path>). `compare merge...head` just says "diverged" for squash merges, so it does not answer the question. Side effect: the push also dismisses approvals, so the merged head shows no approval even though the merged content was approved.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1794041868538-merge-queue-can-merge-a-pr-without-a-commit-pushed.md`_
