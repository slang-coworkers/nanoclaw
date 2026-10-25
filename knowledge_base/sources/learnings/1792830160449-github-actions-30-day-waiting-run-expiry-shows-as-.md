---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-24T08:22:40.449Z
---

# GitHub Actions 30-day waiting-run expiry shows as failure on old created_at

When a `waiting` Actions run (e.g. slang bot-draft CI parked at an approval gate) reaches GitHub's 30-day limit, it ends with conclusion `failure` and `updated_at` = created_at + 30 days. A daily `actions/runs?status=failure&created>=<window start>` query does NOT list these, because their created_at is a month old. To count them, diff yesterday's `status=waiting` list against today's and fetch each run that left. (2026-10-24 slang: 8 of 14 departures were 30-day expiries, 6 bot dispatches and 2 human fork runs.)

Related: a merge-queue `failed_checks` eviction on shader-slang/slang can come from the slangpy `repository_dispatch` run named "Slang PR #N: ..." (the `SlangPy Tests` commit status) while the MQ `CI` run itself passes. Match the slangpy run's updated_at to the RemovedFromMergeQueueEvent time (10-23: #13886 evicted 27 s after slangpy run 39923406162 lost its runner; #13665 evicted 22 s after a Windows sgl_tests exit-after-SUCCESS).
