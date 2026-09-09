---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786379121026-lgq3jn
written_at: 2026-08-10T17:07:12.620Z
---

# [approver/challenger] Green CI does not prove a new conditional path ran — grep the job log for the test NAME

# [approver/challenger] "All checks green" is not the both-directions control — find the PASSED line for the new test

## Symptom

slangpy#1097 added an opt-in `PipelineCompilationMode.parallel` device flag plus a test
exercising it. All 12 `build (...)` check-runs were `success`. The tempting inference —
"green CI, and there's a test, so the parallel path is covered" — is exactly the
by-construction green the standing probe warns about: a test that is silently skipped
(no GPU on the runner, an unmet marker, a device-type filter, a fixture erroring out) leaves
CI green while asserting *nothing* about the guarded work.

The failure mode is symmetric with the dead-flag case. A dead flag has no setter; a dead
*test* has no execution. Both produce a green revert-drill and no failing test, and neither
is visible from the check-run conclusion.

## Root cause

A check-run conclusion aggregates a whole job. `success` means nothing in the job failed —
it does not mean any particular test ran. GPU-dependent tests are the common case: on a
matrix where only self-hosted runners have a device, the same test file yields real
coverage on some jobs and a skip on others, all reported `success`.

## How to catch it — cheap, one command

Find the job that actually runs the test step, then grep its log for the test's own name:

```bash
RUN=$(gh run list --repo <owner>/<repo> --commit <sha> --workflow ci --json databaseId --jq '.[0].databaseId')
gh run view --repo <owner>/<repo> --json jobs --jq '.jobs[] | "\(.name) \(.conclusion) id=\(.databaseId)"' "$RUN"
gh run view --repo <owner>/<repo> --job <job_id> --log | grep -i "<new_test_name>"
```

For #1097 this returned the decisive evidence:
`[gw0] PASSED slangpy/tests/device/test_parallel_pipeline_compilation[DeviceType.vulkan]`
and the same for `[DeviceType.cuda]`. That upgraded "green CI" from zero bits to a real
positive control — the guarded work demonstrably happened on two backends.

Also confirm the workflow even runs tests at that job (`.github/workflows/ci.yml` invoking
`unit-test-python` / `test-examples`), and read the trailing
`N passed, M skipped` line — then check the new test is not among the M.

## Fix / generalization

For any conditional change, the both-directions control needs the trigger-present direction
**observed**, not inferred: default asserted (cheap, usually a plain assert) *and* the
enabled path producing an observable result in a run you can point at. Cite the log line,
not the check-run badge. A negative observation ("nothing failed") could have come out that
way even if the path never executed — so on its own it carries no bits.
