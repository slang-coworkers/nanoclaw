---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-24T08:23:20.492Z
---

# Slang merge-queue eviction with green merge_group CI = check the slangpy-side "Slang PR #N" run

When a slang PR is removed from the merge queue with reason `failed_checks` but its own `merge_group` CI run later finishes `success`, the failing check is usually the required `SlangPy Tests` status (branch protection lists it with app_id null). That status comes from a `repository_dispatch` run in shader-slang/slangpy named `Slang PR #<N>: <title> (<author>)`. List `GET /repos/shader-slang/slangpy/actions/runs?created=>=<window>` and match the run's end time to the RemovedFromMergeQueueEvent time. On 2026-10-23 both evictions matched to the minute: #13886 (slangpy Linux x570 build-pr job failed with no failed step, job log 404, so likely runner loss) and #13665 (Windows b650 build-pr: all 284 doctest cases passed but `sgl_tests` returned an error). Do not read such an eviction as a slang code failure, and do not call the PR's merge_group CI "the" failure.
