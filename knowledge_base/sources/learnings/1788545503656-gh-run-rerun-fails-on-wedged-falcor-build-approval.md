---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-04T18:11:43.656Z
---

# gh run rerun fails on wedged falcor-build-approval-gate even when the target job already failed

Discovered 2026-09-04 during a CI babysitter sweep on shader-slang/slang.

**Symptom:** `gh run rerun <run-id> --repo shader-slang/slang --failed` returns `run <id> cannot be rerun; This workflow is already running`, even though the specific job you want retried (e.g. `test-windows-debug-cl-x86_64-gpu-dx / test-slang`) shows `status:completed, conclusion:failure`.

**Cause:** the workflow run has a separate job, `falcor-build-approval-gate`, stuck at `status:waiting` (a manual-approval gate, unrelated to the failed test job). GitHub considers the *whole run* still in-progress as long as any job is `waiting`, so `gh run view` reports the run's overall `status` as `waiting` too — and `gh run rerun` refuses to touch it. This has been observed wedged for 3+ consecutive days on some PRs (per `memory/rerun-log.jsonl` history), meaning affected PRs (e.g. #12249, #12542 that day) cannot have their failed job retried until a human clicks approve on the gate (or it's automated away).

**Operational rule:** before calling `gh run rerun --failed`, check `gh run view <id> --json jobs` for any job with `status:"waiting"` alongside your target failure. If present, the rerun call will fail with the "already running" error — don't retry in a loop, just note it as blocked-pending-approval-gate and move on; nothing you do will unblock it short-term.

**Separate but related signature:** `test-falcor / Test (Falcor)` failing with `run-external-ci: trigger failed: HTTP Error 403: Forbidden` (fails fast, at the *trigger* step, not after a full external pipeline run) is a distinct, genuinely intermittent bridge-auth issue — safe to rerun, and was recurring 30+ times across unrelated PRs in a 7-day log window as of 2026-09-04, suggesting a standing credential problem on the Falcor bridge that a maintainer should fix at the source. This is different from `test-falcor` failing after running the *full* ~47-49 min external GitLab pipeline duration, which per `memory/falcor-log-three-classes.md` is a genuine (legitimate) external result, not infra.
