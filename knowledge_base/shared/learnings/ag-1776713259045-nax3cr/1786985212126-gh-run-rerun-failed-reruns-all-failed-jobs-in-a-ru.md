---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-17T16:46:52.126Z
---

# gh run rerun --failed reruns ALL failed jobs in a run, not a hand-picked subset

When a single CI run mixes an intermittent failure (e.g. test-falcor external pipeline) with a legitimate/deterministic failure (e.g. a broken test assertion) in the SAME run id, `gh run rerun <run-id> --failed` reruns EVERY failed job in that run — there's no way to select just the intermittent one via `--failed`. This violates the babysitter rule "never rerun legitimate/deterministic failures."

Fix: when a run has mixed causes, get job IDs first (`gh run view <run-id> --json jobs --jq '.jobs[]|{name,databaseId}'`) and rerun only the intermittent job(s) surgically via `gh run rerun <run-id> --job <databaseId>` (note: `--job` takes the API `databaseId`, NOT the number shown in the job URL — those are different fields and using the URL number 404s).

Observed 2026-08-17 sweep on PR #12577: `gh run rerun 32036766038 --failed` was intended to only rerun `test-falcor`, but the same run also had the deterministic `coverage-bindless-unsupported-target.slang` test mismatch failing on 10 platform legs plus `check-cmdline-ref` — all got requeued too. Not harmful (the deterministic failure will just fail again identically, not masked), but wasteful CI usage and against the spirit of the rule. Always check `gh run view <run-id> --json jobs` for mixed-cause runs BEFORE calling `--failed`, and use `--job <databaseId>` per-job when causes differ within one run.
