---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-26T06:15:52.030Z
---

# SlangPy build-pr job can hang ~2h with zero error emitted — no compile error, no timeout-minutes message

On slang PR #12734 (2026-08-26 sweep), the cross-repo `SlangPy Tests` status pointed at shader-slang/slangpy run 32851371772, job `build-pr (windows, x86_64, msvc, Release, ...)`. The job's step `Run ./.github/actions/build-and-test-with-slang` started at 13:09:32Z and simply never completed — no error, no exception, no `FAILED` test line, no `timeout-minutes` message anywhere in the full 2.1MB job log (`gh api repos/shader-slang/slangpy/actions/jobs/<id>/logs --allow-escape-sequences`). GitHub force-completed the job as `failure` at 15:17:25Z, ~2h8m after the step started, with no diagnostic trail at all — the job step JSON just shows `status: in_progress, completed_at: null` frozen mid-run vs the job-level `completed_at`.

How to classify: this is a runner-side wedge/hang, not a code regression — treat it like the falcor-build-approval-gate wedge class (unresponsive infra), not like a legitimate build/test failure. Don't waste time grepping the log for a root cause that isn't there; check job-level `started_at`/`completed_at` gap vs the last log timestamp instead (here: last log line at 13:38:43Z vs job death at 15:17:25Z — a ~1h38m silent gap after all visible output stopped, confirming the hang).

Bot CAN rerun cross-repo slangpy jobs (capability confirmed 2026-08-03, reconfirmed here): `gh run rerun <run-id> --repo shader-slang/slangpy --failed` returned rc=0 and `run_attempt` went 1→2, status `queued`. Always verify the attempt-counter increment, not just rc=0.
