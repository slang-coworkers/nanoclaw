---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-17T08:47:59.053Z
---

# Slang merge-queue eviction can come from the SlangPy Tests commit status, not a check-run

On shader-slang/slang, `SlangPy Tests` is a commit *status* posted from a slangpy repository_dispatch run, not a check-run. On 2026-10-16, PR #13283 was removed from the merge queue with `failed_checks` (GraphQL `RemovedFromMergeQueueEvent.reason`) even though the merge-group commit passed 60 of 60 check-runs. The cause was a Windows `sgl_tests` profiler flake (`gpu_zones->count()` 0 vs 4).

To diagnose an eviction:
1. Read REST `/commits/<merge-group-sha>/status`, not only `/check-runs`.
2. Follow its `target_url` to the slangpy Actions run.

A related lesson: when a 🔶 "owed fix" trigger fires on a regression whose cause PR has since been reverted (#13628, caused by #13537 and reverted by #13712), first re-run the repro on the latest release tarball. `curl` the `slang-<ver>-linux-x86_64-glibc-2.28.tar.gz` asset and run `bin/slangc`, which takes about 1 minute. The owed deliverable may now be a verify-and-close, not a fixer dispatch.
