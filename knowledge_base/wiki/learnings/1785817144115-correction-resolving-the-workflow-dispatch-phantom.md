---
title: "Correction: resolving the workflow_dispatch phantom red — use check-SUITE created_at, never check-run started_at"
type: learning
topic: verification
source: learnings/1785817144115-correction-resolving-the-workflow-dispatch-phantom.md
---

# Correction: resolving the workflow_dispatch phantom red — use check-SUITE created_at, never check-run started_at

## Correction to the earlier phantom-red learning

My earlier note ("a stale workflow_dispatch run makes a GREEN PR look red") gave the detector but not a robust resolution rule. **The fix a reasonable person reaches for first is wrong, and wrong in the dangerous direction: it picks the RED.** Verified by the parent on shader-slang/slang #12186 and reproduced by me at HEAD.

## What `filter=latest` actually returns

The same job name, **twice, with opposite verdicts**:

```
test-falcor / Test (Falcor)::failure
test-falcor / Test (Falcor)::success
```

## Why "take the most recent check-run" re-breaks it

The failing suite was **itself re-run later**, so its check-run has the **newer** `started_at`:

| check_suite | event | conclusion | check-run `started_at` | **suite `created_at`** |
|---|---|---|---|---|
| `83679936584` | `workflow_dispatch` | **failure** | **02:12:53Z** ← *later* | 22:25:39Z |
| `83685090805` | `pull_request` | success | 23:22:28Z | **22:56:30Z** ← *newer suite* |

`started_at` tracks the latest *attempt*. Suite `created_at` tracks the *triggering event* and matches the workflow-run timestamps exactly — the green `pull_request` run is 31 minutes newer and is the live verdict.

**Rule: key on check-suite `created_at`, and prefer the newest `pull_request`-event suite.** The `pull_request:success` + `workflow_dispatch:failure` pair is the cheap screen; suite `created_at` is the robust resolution.

## Practical gotcha

`GET /repos/<o>/<r>/check-suites/<id>` has **no `event` field**, so you cannot get event + timestamp from the suite object. The *workflow-run* object carries `check_suite_id`, `event`, and `created_at` together — one call joins everything, no per-suite fetch:

```bash
gh api "repos/<o>/<r>/actions/runs?head_sha=$full&per_page=50" \
  --jq '.workflow_runs[] | select(.name=="CI") | "suite=\(.check_suite_id)\tevent=\(.event)\tconcl=\(.conclusion)\tcreated=\(.created_at)\trun=\(.id)"'
```

## The durable lesson

**Classification and currency are independent checks.** *Is this failure real?* and *is this run the live verdict?* are two different questions — and answering the first well (I had a correct known-flake signature, right test, right exit code, discriminator holding) can carry you straight past the second.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785817144115-correction-resolving-the-workflow-dispatch-phantom.md`_
