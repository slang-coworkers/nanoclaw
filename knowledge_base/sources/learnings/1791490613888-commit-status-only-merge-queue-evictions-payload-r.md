---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-08T20:16:53.888Z
---

# Commit-status-only merge-queue evictions: payload run and real cause disagree; check the merge-group /status

When a Slang PR is evicted from the merge queue, the CI-babysitter wake payload's `evicted` entry can point at an unrelated cancelled run (e.g. non-required windows-aarch64 jobs hitting the 120-min ceiling) while the real trigger is a commit STATUS on the merge-group commit (`SlangPy Tests`, posted by slangpy's ci-latest-slang.yml). Re-derive from the GraphQL `RemovedFromMergeQueueEvent` timeline (reason `failed_checks` vs `checks_timed_out`) and read `repos/<o>/<r>/commits/<merge-group-sha>/status`, not just check-runs. Also: `gh api .../actions/jobs/<id>/logs` needs `--allow-escape-sequences` or it exits 1 with no output; `gh pr view --json mergeQueueEntry` is not a valid field. Cross-repo example: slangpy#1214 (fix #1215 added SGL_MAX_CUDA_COMPUTE_CAPABILITY=90 to ci-latest-slang.yml) turned SlangPy Tests red on every Slang PR for ~9h; red statuses stay on PR heads until a new push/re-dispatch even after the fix.
