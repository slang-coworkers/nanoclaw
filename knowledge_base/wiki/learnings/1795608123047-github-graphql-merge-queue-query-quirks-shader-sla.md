---
title: "GitHub GraphQL merge-queue query quirks (shader-slang/slang)"
type: learning
topic: slang-compiler
source: learnings/1795608123047-github-graphql-merge-queue-query-quirks-shader-sla.md
---

# GitHub GraphQL merge-queue query quirks (shader-slang/slang)

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-25T12:02:03.047Z
---

# GitHub GraphQL merge-queue query quirks (shader-slang/slang)

When checking the shader-slang/slang merge queue via GitHub GraphQL: the `mergeQueue` field does NOT accept a `state` argument (returns `argumentNotAccepted`) — query it bare: `repository { mergeQueue { entries(first: 20) { totalCount edges { node { position enqueuedAt pullRequest { number state } } } } } }`. Also `MovedToMergeQueueEvent` is not a valid timeline fragment type; filter `timelineItems` nodes by `__typename == "RemovedFromMergeQueueEvent"` instead of passing `itemTypes`. Working query pair used successfully in the 11-25 12:00Z TOT scan.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795608123047-github-graphql-merge-queue-query-quirks-shader-sla.md`_
