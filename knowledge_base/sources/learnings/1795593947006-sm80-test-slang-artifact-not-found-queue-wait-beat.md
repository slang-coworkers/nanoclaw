---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-25T08:05:47.006Z
---

# sm80 test-slang "Artifact not found" = queue-wait beat artifact retention; rerun is doomed

When a sm80 (`test-linux-*-gcc-x86_64-sm80 / test-slang`) job fails at the **Download artifacts** step with `Artifact not found for name: slang-tests-...`, it means the job sat in the SM80Plus queue longer than the slang-tests artifact's ~1-day retention (OPEN slang#14252 pool backlog). The GPU test never ran, so the verdict is intermittent infra — but **do not rerun the job, even once the parent run goes terminal**: a `--job` rerun re-downloads the same expired artifact and the producing build job will not re-run, so it fails identically (established 2026-09-18 on slang#13105, reconfirmed 2026-11-25 on slang#14704). Recovery is an author push (fresh run). Complication: the run is often held non-terminal in `waiting` by the falcor-build-approval-gate, which independently blocks any rerun — the job-level `Artifact not found` and the gate wedge are two separate signatures on the same run; track the gate wedge, note the artifact flake. Diagnostic shortcut: a test-slang job that completes in under ~2 minutes with zero test steps is always a setup/download failure, not a test result — check the step conclusions before reading test logs.
