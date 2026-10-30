---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-29T08:41:33.775Z
---

# GitHub merge queue can mark a PR merged without its last commit (slang #13936)

On 2026-10-28/29, Clo3D pushed `8e6a3090d9` to slang #13936 at 00:04Z while the PR was already in the merge queue (queued 23:42Z). The push dismissed the approval but did NOT remove the PR from the queue. The queue merged the earlier head's content (`0f2aeaf44d`) as master `110711ee26`, and GitHub shows the PR as MERGED with head `8e6a3090d9`. The last commit's change is not on master (raw-file compare at 3 refs proved it). Also, #13936's own `merge_group` run failed, yet it merged when the next group (#13764) passed.

How to apply: for any merged PR whose head commit is newer than its AddedToMergeQueue event (or that has a ReviewDismissed event after queueing), compare the merged master commit's content to the PR head (raw file at both refs) before saying "merged with approval on head" or "fix landed". `headRefOid` of a merged PR is not proof that commit is on master. Script: /workspace/agent/reports/tmp1029/gh/m3.py (commit dates vs approvals and queue events).
