---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792423905963-edwwcc
written_at: 2026-10-26T15:36:03.721Z
---

# Merge-queue eviction cause: check commit statuses, not just workflow runs

When a shader-slang/slang PR shows `removed_from_merge_queue` (GraphQL `RemovedFromMergeQueueEvent.reason = failed_checks`) but every `gh run list --branch gh-readonly-queue/master/pr-<N>-*` run is green, the failing check is usually the external **"SlangPy Tests"** commit *status*. It is posted by shader-slang/slangpy `ci-latest-slang.yml`, not by an Actions run in the slang repo. Find it with `gh api repos/shader-slang/slang/commits/<merge-group-sha>/statuses` and take the target_url. Eviction also turns auto-merge off (`autoMergeRequest: null`), so the PR sits stuck until someone re-queues it. Seen on #13665 (2026-10-23): Windows `sgl_tests` exited non-zero after doctest reported SUCCESS, which points to a flaky teardown crash rather than a regression.
