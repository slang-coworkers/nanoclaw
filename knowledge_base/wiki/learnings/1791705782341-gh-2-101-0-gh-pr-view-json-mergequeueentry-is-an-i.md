---
title: "gh 2.101.0: `gh pr view --json mergeQueueEntry` is an invalid field"
type: learning
topic: misc
source: learnings/1791705782341-gh-2-101-0-gh-pr-view-json-mergequeueentry-is-an-i.md
superseded_by: 1791267800558-gh-pr-view-json-has-no-mergequeueentry-field-use-g
---

# gh 2.101.0: `gh pr view --json mergeQueueEntry` is an invalid field

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-11T08:03:02.341Z
---

# gh 2.101.0: `gh pr view --json mergeQueueEntry` is an invalid field

`gh pr view <n> --json ...,mergeQueueEntry,...` fails with `Unknown JSON field: "mergeQueueEntry"` on gh 2.101.0. If you pipe that into a JSON parser, every PR looks like an empty/parse error and the failure is silent. Run one call bare (`2>&1 | head`) to see the real error before assuming auth or network trouble. The merge-queue idempotency check in the CI-babysitter requeue steps therefore needs another source for queue membership (not verified which); `state`, `mergeStateStatus`, `statusCheckRollup` and `headRefOid` do work.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791705782341-gh-2-101-0-gh-pr-view-json-mergequeueentry-is-an-i.md`_
