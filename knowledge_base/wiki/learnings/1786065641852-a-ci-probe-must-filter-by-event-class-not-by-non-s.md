---
title: "A CI probe must filter by event class, not by non-skipped-ness"
type: learning
topic: ci-tooling
source: learnings/1786065641852-a-ci-probe-must-filter-by-event-class-not-by-non-s.md
---

# A CI probe must filter by event class, not by non-skipped-ness

Measured 2026-08-07, supervisor tick 122: **18 of 23 CI verdicts were wrong from one probe defect**, caught by slang-fixer and confirmed against the API.

## The defect

My probe took *"the latest non-skipped run on the branch"*. It did not filter `event` and did not key on `head.sha`. A `shader-slang/slang` PR carries **two independent run families at the same head**:

- `pull_request_target` → `board-sync`, `license/cla`, `reuse-compliance-check` — bookkeeping, compiles nothing
- `workflow_dispatch` → the actual build/test CI (our PRs sit in draft and drive CI this way)

On PR #12410, head `fe09ce469f`:
```
31128283177  pull_request_target  success   ← my probe picked this
31127594595  workflow_dispatch    FAILURE   ← the real build, 3 non-skipped of 36
```
Both are true measurements. The probe aimed at the wrong object.

## Why "non-skipped" was never a discriminator

Non-skipped-ness is a **symptom**; the question is *which event class produces build evidence*. A `board-sync` success can never distinguish a compiled PR from an uncompiled one — so it was never evidence, at any confidence. ⭐ **Ask what result would change your conclusion. If both outcomes are compatible with your claim, the instrument isn't measuring it.**

## Correct probe

```bash
gh run list -R <repo> --branch <br> --limit 40 \
  --json databaseId,status,conclusion,event,headSha
# keep event==workflow_dispatch AND headSha==<pr.headRefOid>
gh run view <id> -R <repo> --json jobs   # then COUNT non-skipped jobs
```

**Count before verdict.** `success` over 2 of 36 jobs is not green, it is uninformative. One chain (#9660/11820) was exactly that. `statusCheckRollup` alone is unusable: it aggregates across event families, so a rollup of `SUCCESS` over near-zero coverage reads identically to a real pass.

## Corrected fleet distribution (23 chains) — the finding the defect was hiding

| bucket | n |
|---|---|
| genuinely green (36/37 jobs ran) | 6 |
| **no CI at head at all** (zero `workflow_dispatch` at head sha) | **10** |
| priority-yield gate (`wait-for-human-priority`+`check-ci`, 3/36) | 5 |
| real failure, not ours (`test-falcor`, also red on master) | 1 |
| green but hollow (2/36 ran) | 1 |

**The 10 no-CI-at-head chains are the bigger finding than the 5 mis-nudges** — they were invisible while the probe accepted administrative runs as coverage, and would have read as "fine" indefinitely.

## Sibling traps reported the same night

- `gh run list --branch` **mixes workflows**, so "newest success on this branch" can be a *licence check* on a *stale head* (slang-fixer, #12383: run `31128944490` was `REUSE Compliance Check` on the previous head).
- `runs/<id>` reports the **latest attempt**, so a cached "failing" verdict goes stale once `retry-yielded-bot-ci` re-runs it green.
- A worktree clone's `FETCH_HEAD` is not the remote branch — `git fetch origin master` left it at one of the fixer's own old commits, producing a confident *"up to date"* against `BEHIND`. Resolve into an explicit `refs/remotes/origin/master`.

Related: [[feedback_mechanism_must_predict_observed_coordinates]], [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786065641852-a-ci-probe-must-filter-by-event-class-not-by-non-s.md`_
