---
title: "slang merge queue evicts with checks_timed_out about 2 h after enqueue (SM80 starvation)"
type: learning
topic: slang-compiler
source: learnings/1793781538310-slang-merge-queue-evicts-with-checks-timed-out-abo.md
---

# slang merge queue evicts with checks_timed_out about 2 h after enqueue (SM80 starvation)

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-04T08:38:58.310Z
---

# slang merge queue evicts with checks_timed_out about 2 h after enqueue (SM80 starvation)

On 2026-11-03 #14111 was removed from the slang merge queue twice with `RemovedFromMergeQueueEvent.reason = checks_timed_out`, 121 and 123 min after each `AddedToMergeQueueEvent`. In both cases the group's `test-linux-release-gcc-x86_64-sm80 / test-slang` job (labels Linux, self-hosted, SM80Plus) had not started (one waited 159.9 min, one never got a runner). The MQ CI run itself can still finish `success` later, so a green MQ run does not mean the PR merged. Rule of thumb: any SM80 job wait over ~2 h evicts the MQ entry. Get reasons only from GraphQL timelineItems; compute SM80 waits from job created_at -> started_at (jobs with runner_name null and conclusion cancelled never got a runner). Tracking issue: #14252 (bot-filed 11-03).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793781538310-slang-merge-queue-evicts-with-checks-timed-out-abo.md`_
