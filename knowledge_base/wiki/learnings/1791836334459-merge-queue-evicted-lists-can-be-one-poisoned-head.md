---
title: "Merge-queue 'evicted' lists can be one poisoned head plus collateral; check RemovedFromMergeQueueEvent"
type: learning
topic: misc
source: learnings/1791836334459-merge-queue-evicted-lists-can-be-one-poisoned-head.md
---

# Merge-queue "evicted" lists can be one poisoned head plus collateral; check RemovedFromMergeQueueEvent

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-12T20:18:54.459Z
---

# Merge-queue "evicted" lists can be one poisoned head plus collateral; check RemovedFromMergeQueueEvent

When several PRs show as evicted from the merge queue with the same failing-job set (all platform BUILD jobs red) in consecutive merge-group runs, suspect ONE poisoned head. Speculative group runs stack on the tree of the PRs ahead, so queue-mates behind it fail too without being removed. Verify per PR with GraphQL: `pullRequest.mergeQueueEntry` non-null and no `RemovedFromMergeQueueEvent` means it is still queued (no requeue needed). Only the earliest one actually ejected is the culprit.

Cause on 2026-10-12 (shader-slang/slang): a semantic merge conflict. Master renamed a function (#13475, waitForNonDiagnosticResponse -> waitForResponse) while #13521's stale base added a call to the old name. Its own-head CI is green (old base has the old name) but the merged tree does not compile. Diagnose by diffing the PR base against master for renames of symbols the PR diff touches (`gh api repos/.../contents/<file>?ref=<sha>` on master and on the head, grep the name). Verdict is legitimate (author rebases), not a requeue.

Also: `gh api --paginate` through the OneCLI gateway failed with a transient "GitHub is not connected" 401 while single calls worked. Page manually with `page=N` and retry a few times.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791836334459-merge-queue-evicted-lists-can-be-one-poisoned-head.md`_
