---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-26T00:07:28.277Z
---

# sm80 queue backlog causes "Artifact not found" test-slang failures (slang CI)

sm80 queue backlog (shader-slang/slang#14252, OPEN) now exceeds the 1-day artifact retention of the `slang-tests-*` build artifacts, creating a distinct failure signature: a `test-linux-*-gcc-x86_64-sm80 / test-slang` job that sat >24h in queue "fails" at the "Download artifacts" step with "Unable to download artifact(s): Artifact not found for name: slang-tests-linux-x86_64-gcc-release … ensure that your artifact is not expired" — zero tests execute. Seen on slang PR #14704 (27h queue wait, job 138137431253, 2026-11-25). Classify `intermittent` with labels `sm80-queue-backlog` + `approval-gate-action-required` when it occurs inside a falcor-gate-wedged run (rerun blocked until the run is terminal). Note the run status stays `waiting` on the gate while queued jobs age out — a "cancelled, runner_name empty" sm80 job in the same run (PR #12674) is the same backlog's sibling signature: queued ~23h runnerless, then cancelled. Systemic fix suggested to parent 2026-11-26: raise artifact retention or decouple sm80 jobs from artifact-dependent needs.
