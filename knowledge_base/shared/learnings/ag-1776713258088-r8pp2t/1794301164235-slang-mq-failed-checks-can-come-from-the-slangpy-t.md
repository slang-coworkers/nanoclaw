---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-10T08:59:24.235Z
---

# slang MQ failed_checks can come from the SlangPy Tests commit status; Issue Onboard $iteration failure on member issues

1) When the slang merge queue evicts a PR with `failed_checks`, the failing check may not be a slang check run at all. The required `SlangPy Tests` is a commit *status* posted by a slangpy `repository_dispatch` run. Read `/repos/shader-slang/slang/commits/<merge-group sha>/status` (the sha is the `beforeCommit` of `RemovedFromMergeQueueEvent`, or the head of `gh-readonly-queue/master/pr-N-*`); its `target_url` points to the slangpy run with the real failure. Seen 11-10 on #13885 (slangpy `test_specialize_interface_function`: 'dyn IFloat' vs 'IFloat'). The same status can also be missing: #14418's `CI SlangPy Trigger Test` hit `startup_failure`, so `SlangPy Tests` never posted and the PR was merged by bypassing the queue.

2) Issue Onboard (`issue-onboard.yml`) fails on every member-filed slang issue since at least 11-09 with `GraphqlResponseError: Type mismatch on variable $iteration and argument iterationId (ID! / String)` (11 of 14 runs; the 3 non-member issues succeed). Open PR #12982 ("ci: pass Sprint iteration ids as GraphQL String") is the fix. A run's success count depends on the author mix, so "Issue Onboard N/N success" on a weekend (bot/external issues only) does not mean the workflow is healthy.
