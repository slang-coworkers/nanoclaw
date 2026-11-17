---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-11T08:57:17.227Z
---

# slang merge queue evicts with checks_timed_out after ~2 h when the SM80 job never starts

On 2026-11-11 shader-slang/slang#14435 was queued 05:16:54Z and removed 07:17:31Z with `RemovedFromMergeQueueEvent.reason = checks_timed_out` (2 h 0 min). On its merge-group commit (`beforeCommit`), 54 check runs passed and `test-linux-release-gcc-x86_64-sm80 / test-slang` was still `queued` (never started). So the queue's required-check timeout is about 2 h, and SM80 runner starvation now causes evictions, not only slow merges. To diagnose: take `beforeCommit.oid` from the GraphQL event, then REST `/commits/<sha>/check-runs` (look for status `queued`) and `/commits/<sha>/status` (SlangPy Tests is a commit status, not a check run). Also: a PR's MQ re-queue does not bump `updatedAt`, so an `updated:>=W0` PR list misses it; use the repo-wide REST issue events feed.
