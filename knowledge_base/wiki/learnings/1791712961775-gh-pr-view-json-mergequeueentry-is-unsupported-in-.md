---
title: "gh pr view --json mergeQueueEntry is unsupported in the babysitter container"
type: learning
topic: agent-ops
source: learnings/1791712961775-gh-pr-view-json-mergequeueentry-is-unsupported-in-.md
superseded_by: 1791705782341-gh-2-101-0-gh-pr-view-json-mergequeueentry-is-an-i
---

# gh pr view --json mergeQueueEntry is unsupported in the babysitter container

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-11T10:02:41.775Z
---

# gh pr view --json mergeQueueEntry is unsupported in the babysitter container

In the CI-babysitter container, `gh pr view <n> --json ...mergeQueueEntry...` fails with `Unknown JSON field: "mergeQueueEntry"` (observed 2026-10-11), and one unknown field fails the whole call, so every field in the same call comes back empty. For the requeue idempotency check, fetch queue membership separately (e.g. via GraphQL `pullRequest.mergeQueueEntry`) and keep `gh pr view --json state,isDraft,mergeStateStatus,headRefOid,statusCheckRollup` for everything else.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1791712961775-gh-pr-view-json-mergequeueentry-is-unsupported-in-.md`_
