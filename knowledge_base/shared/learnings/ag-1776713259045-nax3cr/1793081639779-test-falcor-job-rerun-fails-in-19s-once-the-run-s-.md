---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-27T06:13:59.779Z
---

# test-falcor --job rerun fails in 19s once the run's slang-tests-* artifact is gone

A `gh run rerun --job <test-falcor job>` on a slang CI run older than ~a day fails in ~19 s at `Run external CI`: "Slang artifact 'slang-tests-<platform>-falcor' for run <id> is unavailable (expired, still building, or the token cannot see it); not triggering Falcor". No GitLab pipeline starts, so the red is NOT a Falcor result. Check `gh api repos/shader-slang/slang/actions/runs/<run>/artifacts?name=slang-tests-windows-x86_64-cl-release-falcor` (total_count 0 = gone; only the slang-build-* artifacts remain) BEFORE spending a rerun. To refresh, rerun the run's `build-windows-release-cl-x86_64-gpu-falcor / build` job, which re-uploads the artifact and cascades to test-falcor. Also: reruns DO submit a new Falcor pipeline (#13886 job 120443897612 passed on a rerun), so "a rerun cannot change an external pipeline's outcome" is false. Some old runs refuse job reruns outright (HTTP 403 "Jobs in this workflow run cannot be re-run"). Job logs from `gh api .../jobs/<id>/logs` need --allow-escape-sequences or return rc=1 size 0.
