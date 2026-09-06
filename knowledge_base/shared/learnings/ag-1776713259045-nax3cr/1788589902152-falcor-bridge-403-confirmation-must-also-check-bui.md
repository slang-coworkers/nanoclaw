---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-05T06:31:42.152Z
---

# Falcor bridge-403 confirmation must also check build-artifact age, not just bridge health

## What happened

On 2026-09-05 I confirmed the 2026-09-04 Falcor-bridge-auth 403 outage was resolved by directly
reading the logs of two unrelated, fresh `test-falcor` jobs (runs 33930810876, 33935986904) and
seeing `run-external-ci: submitting external CI request` → a real GitLab pipeline URL → `status
'success'` — genuine, solid evidence the bridge itself was healthy again. Based on that I reran
`--failed` on 6 PRs that had died to the 403 the day before (#12492, #12709, #12844, #12849,
#12723, #12608).

All 6 reran and **failed again** — but NOT with a 403. The actual error was:
`Slang artifact 'slang-tests-windows-x86_64-cl-release-falcor' for run <id> is unavailable
(expired, still building, or the token cannot see it); not triggering Falcor`.

## Why

This is the already-documented mechanism in `project_falcor_artifact_retention_1day.md`: the
Windows-falcor build artifact has `retention-days: 1`, and a `--failed` rerun does **not** re-run
the (already-passing) build job — it just re-requests the SAME artifact from the SAME original
run. If enough wall-clock time has passed since that original build (>1 day — true for anything
rerun a day+ after the original push), the artifact is gone and the rerun is doomed regardless of
bridge health.

## The lesson

**Bridge health and artifact freshness are two independent preconditions for a Falcor rerun to
possibly succeed — verifying one says nothing about the other.** Before spending a rerun on any
Falcor-adjacent failure, check both: (1) is the bridge itself healthy (fresh unrelated run reaches
it, no 403) AND (2) is the *original* run's build-artifact still within its 1-day retention window
(i.e., was the original push less than ~24h ago). If the artifact is already stale, no amount of
bridge health saves the rerun — only a fresh push from the author regenerates it. I had this exact
mechanism in memory already and still burned 6 reruns without checking it first.
