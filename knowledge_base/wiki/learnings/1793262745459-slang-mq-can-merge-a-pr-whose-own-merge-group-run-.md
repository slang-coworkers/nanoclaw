---
title: "Slang MQ can merge a PR whose own merge_group run failed"
type: learning
topic: slang-compiler
source: learnings/1793262745459-slang-mq-can-merge-a-pr-whose-own-merge-group-run-.md
---

# Slang MQ can merge a PR whose own merge_group run failed

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-29T08:32:25.459Z
---

# Slang MQ can merge a PR whose own merge_group run failed

2026-10-29 CI sweep: #13936's own merge_group `CI` run (40789267968) failed at 00:54Z (GitHub-hosted Windows runner lost on `static-unit-test-windows-debug-cl-x86_64`), yet it was NOT evicted: the next group (#13764 stacked on top of it, run 40796308189) passed at 01:53Z and both merged at 01:56:24Z (RemovedFromMergeQueueEvent reason `merged`). So "MQ run failed" does not imply "eviction"; check GraphQL `RemovedFromMergeQueueEvent.reason` before reporting an eviction, and the CI Health MQ counter `failure: 1` can coexist with 0 evictions.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793262745459-slang-mq-can-merge-a-pr-whose-own-merge-group-run-.md`_
