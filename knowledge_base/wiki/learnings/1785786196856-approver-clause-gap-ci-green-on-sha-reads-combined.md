---
title: "[approver/clause-gap] ci_green_on_sha reads combined status, which is blind to check-runs"
type: learning
topic: review-approval
source: learnings/1785786196856-approver-clause-gap-ci-green-on-sha-reads-combined.md
---

# [approver/clause-gap] ci_green_on_sha reads combined status, which is blind to check-runs

# [approver/clause-gap] `ci_green_on_sha` says success while every build is still in_progress

**Symptom.** On shader-slang/slangpy#1090, at the moment of first evaluation
`GET /commits/<sha>/status` returned `state: success` — while
`GET /commits/<sha>/check-runs` showed **6 of 12 builds `in_progress`**, including
both macOS jobs (the only Metal-capable platform, and the platform the PR targets).
A CI-green clause keyed on the combined status would have reported green over a
build that had not finished and could still fail.

**Root cause.** The two GitHub CI surfaces are disjoint:
- **Combined status** (`/status`) aggregates only legacy *commit statuses*. On
  slangpy that is just `license/cla` and `CodeRabbit` — both of which post early.
- **Check-runs** (`/check-runs`) is where GitHub Actions reports every `build (...)`
  matrix job. Actions posts check-runs, *not* commit statuses.

So `state == "success"` means "the handful of legacy statuses passed", never "CI is
green". `eval-clauses.py:187` reads only the combined status, and its `pending`
branch cannot fire when no Actions job contributes a status at all.

**Why it did not bite here.** The mounted `v0-shadow-relaxed` policy sets
`require_ci_green: false`, so the clause short-circuits to
`pass ("policy does not require CI green")` without any fetch. The gap is latent —
it activates for any approver whose policy sets `require_ci_green: true`, which is
the **bundled v0 default**, i.e. the conservative configuration is the one that
gets the wrong answer.

**How to catch it.** Never treat combined status as CI state on an Actions repo.
Cross-check the check-runs endpoint and confirm no run is `queued`/`in_progress`
and none concluded `failure`/`cancelled`/`timed_out`:

    gh api "repos/$REPO/commits/$SHA/check-runs?per_page=100" \
      --jq '[.check_runs[]|{status,conclusion,name}]'

If any check-run is non-terminal, the correct clause value is **unevaluable**
(=> `ABSTAIN_INFRA:CLAUSE_UNEVALUABLE:ci_green_on_sha`), not pass.

**Fix.** In `eval-clauses.py`'s `ci_green_on_sha`, AND the combined status with a
check-runs sweep; report `unevaluable` on any non-terminal run and `fail` on any
adverse conclusion. Related trap: a green build-only job proves *compilation*, not
that the changed path is **executed** — see the untested-native-handle-path gap on
slangpy#1090.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785786196856-approver-clause-gap-ci-green-on-sha-reads-combined.md`_
