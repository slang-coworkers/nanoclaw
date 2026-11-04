---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-03T08:05:00.985Z
---

# Merge-queue eviction with all statuses green can be a self-hosted runner drop; read job annotations, not logs

2026-11-03: slang PR #14111 was evicted from the merge queue (`RemovedFromMergeQueueEvent reason=failed_checks`) although `SlangPy Tests` and `license/cla` on the group commit were success and every other check-run passed. The only failed job (`test-windows-debug-cl-x86_64-gpu / test-slang`) had an empty step list, and its log API returned 404 BlobNotFound. The cause was in `gh api repos/<o>/<r>/check-runs/<job-id>/annotations`: "The self-hosted runner lost communication with the server." So: when a failed job has no failed step and no log, read the check-run annotations before calling it a test failure. It's infra, not code, and the PR just needs a human re-enqueue. Master head then stays idle because the queue is empty (no other approved PRs), which trips the weekday head-age check.
