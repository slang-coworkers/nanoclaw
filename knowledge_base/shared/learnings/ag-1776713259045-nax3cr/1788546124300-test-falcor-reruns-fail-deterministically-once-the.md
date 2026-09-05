---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-04T18:22:04.300Z
---

# test-falcor reruns fail deterministically once the parent workflow run is stale — check run age, not just error text

## What happened

On 2026-09-04 a sweep (driven by fresh classify-only subagent output, with no cross-check against `rerun-log.jsonl` history) re-classified 7 PRs' `test-falcor / Test (Falcor)` failures as `intermittent` and fired `gh run rerun --failed` on all of them — even though those exact run_ids already carried an explicit `legitimate` / "not fixable by rerun" verdict from 2026-08-31 and 2026-09-03 correction passes (one, PR 12492, had even been explicitly left un-reran *earlier the same day*, at 06:20Z).

Live re-verification after the mistaken reruns confirmed the prior verdict was right: all 6 completed reruns re-failed within seconds-to-minutes with an identical message:
```
run-external-ci: Slang artifact 'slang-tests-windows-x86_64-cl-release-falcor' for run <id> is unavailable (expired, still building, or the token cannot see it); not triggering Falcor
```

## Root cause (mechanical, not probabilistic)

`gh run rerun <id> --failed` only reruns the **failed job**, not the artifact-producing build jobs earlier in the same workflow run. The Falcor bridge (`run-external-ci`) needs a build artifact from that same run. Once the run is more than ~1-2 days old, the artifact has expired, so **any** rerun of the isolated `test-falcor` job is doomed before it even reaches the external bridge — regardless of whether the originally-observed error text was "403 Forbidden" or an artifact-unavailable message. Those were likely the same underlying condition observed at different times/bridge-code versions, which is why the team's classification of this cluster kept flip-flopping between "403" and "artifact-TTL" theories.

## Rule going forward

Before classifying a `test-falcor` failure as intermittent-and-rerunnable, check the **original run's `created_at`** (`gh api /repos/.../actions/runs/<id>` → `created_at`). If it's >24h old, do not rerun via `--failed` — it structurally cannot succeed. Flag for a human: needs a fresh commit or a full (non-`--failed`) workflow rerun that rebuilds the artifact.

## Process gap this exposed

Classify-only subagents derive verdicts fresh from raw logs and have no write access to `rerun-tracker.json`/`rerun-log.jsonl`, so they can't see (and weren't told to check) prior terminal verdicts on the same run_id. The parent is supposed to review before acting but in this case executed the fresh classification without grepping the log for the run_id first. Fix: **the parent must grep `rerun-log.jsonl` for the exact run_id before executing any rerun**, regardless of what a classify-only subagent recommends — a fresh "looks intermittent" read is not sufficient when durable history already says otherwise for that identical run.
