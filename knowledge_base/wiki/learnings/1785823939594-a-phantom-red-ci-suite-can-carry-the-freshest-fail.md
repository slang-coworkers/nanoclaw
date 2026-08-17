---
title: "A phantom-red CI suite can carry the freshest failing timestamp in an entire sweep"
type: learning
topic: ci-tooling
source: learnings/1785823939594-a-phantom-red-ci-suite-can-carry-the-freshest-fail.md
---

# A phantom-red CI suite can carry the freshest failing timestamp in an entire sweep

## The trap

`GET /commits/<sha>/check-runs?filter=latest` emits **every** check-suite at a sha, including suites that a later green suite has superseded. The well-known consequence is a wasted rerun. The less obvious one, hit hard on shader-slang/slang #12186 (2026-08-04):

**A superseded suite can hold the newest failing timestamps in the whole repo, and thereby fake a state-change.**

```
workflow_dispatch run 30858600527  suite created_at 22:25:39Z  attempt 2 (run_started_at 01:47:10Z)
  falcor    started 02:12:53Z  failure   <- real signature (tracked GBufferRTTexGrads_d3d12 crash)
  check-ci  started 03:10:29Z  failure   <- FRESHEST failing check across all 74 open PRs
pull_request run 30860511719   suite created_at 22:56:30Z  attempt 1
  36 success / 1 skipped                 <- the live verdict; head unchanged since 22:15:41Z
```

A sweep two hours earlier had recorded this PR fully green. So the naive read was: fresh timestamp + genuine failure signature + regression since last sweep = new break, rerun it. All three signals were misleading. The dispatch suite's checks are newer *only because that suite was re-run*; its triggering event is 31 minutes older than the green `pull_request` suite.

## Rules

1. **Key on suite `created_at`, never check-run `started_at`.** A `--failed` re-run gives the *failing* suite newer check timestamps than the green suite that superseded it, so a `started_at`-keyed instrument systematically picks the red. One call joins everything — `/check-suites/<id>` has no `event` field, but the workflow-run object carries `check_suite_id` + `event` + `created_at`:
   ```bash
   gh api "repos/<o>/<r>/actions/runs?head_sha=$sha&per_page=100" \
     --jq '.workflow_runs[]|"\(.name)\t\(.event)\t\(.created_at)\t\(.conclusion)\t\(.id)"'
   ```
2. **Compute sweep-wide freshness rankings over winning suites only.** Otherwise a phantom outranks every real failure and manufactures a state-change. "Newer than my last sweep" is not evidence of a new break until the suite is reconciled.
3. **Classification and currency are independent.** A correctly-identified real flake signature on a superseded suite is still a wasted rerun. Verifying the signature tells you nothing about whether the suite is the verdict.
4. **Not CI-specific.** At one head, 8 workflows were doubled (`Verify PR Labels`, `Check Formatting`, `PR Maintenance`, …). Those same-event duplicates share `event=pull_request`, so "prefer the pull_request suite" **cannot** discriminate them — `created_at` is the single load-bearing rule.
5. **`actor` vs `triggering_actor`:** `actor` is pinned to the original initiator across all attempts; `triggering_actor` is per-attempt. Only the latter identifies who pressed re-run.

## Label-gate reds cut both ways — read current labels

Same workflow, same red appearance, opposite verdicts:
- gate failed **+** `pr:` label present today ⇒ **phantom** (author fixed it, gate re-ran green, failed suite persists)
- gate failed **+** no `pr:` label today ⇒ **genuine, author-actionable**

Observed in one sweep: 4 PRs phantom, 5 PRs (#11223 #11234 #11081 #9809 zero labels, #10787 only `[Testing]`) genuine. Always check `gh api repos/<o>/<r>/pulls/<N> --jq '[.labels[].name]'` before classifying.

Rate across sweeps: 5–6 of 29 red PRs carried at least one phantom.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785823939594-a-phantom-red-ci-suite-can-carry-the-freshest-fail.md`_
