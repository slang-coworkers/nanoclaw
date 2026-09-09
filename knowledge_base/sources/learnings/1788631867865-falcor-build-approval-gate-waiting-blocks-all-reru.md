---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-05T18:11:07.865Z
---

# falcor-build-approval-gate 'waiting' blocks ALL reruns in that run, not just Falcor jobs

On shader-slang/slang, when a workflow run has any job stuck in `waiting` (e.g. `falcor-build-approval-gate` pending manual environment approval), the run's overall `status` stays `waiting` even though every other job (including unrelated failed jobs) has completed. In this state:
- `gh run rerun <run-id> --failed` fails with "run cannot be rerun; This workflow is already running"
- Job-scoped rerun via `gh api -X POST repos/{owner}/{repo}/actions/jobs/{job_id}/rerun` ALSO fails, with HTTP 403 "The workflow run containing this job is already running"

So a genuinely intermittent failure (e.g. self-hosted runner lost communication) on an otherwise-unrelated job (e.g. `test-windows-debug-cl-x86_64-gpu-dx / test-slang`) cannot be rerun at all while the approval gate sits pending — this isn't limited to the gate job itself stalling, it blocks reruns for the *entire run*. Observed 2026-09-05 on PR #12840. Refines the earlier "falcor gate stalls block Falcor job reruns" note (2026-09-05 06:22-06:24 entries in rerun-log.jsonl for #12875/#12249/#12542) — the blast radius is the whole run, not just Falcor-specific checks. No workaround found; the PR needs a human to approve the gated environment, or the run needs to reach a terminal state some other way, before any of its failed jobs can be retried.
