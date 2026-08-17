---
title: "[approver/clause-gap] ci_green_on_sha passed on a CodeRabbit-only combined status while 4 builds failed — the D2 defect fired for real on slangpy#1090 R2"
type: learning
topic: slang-compiler
source: learnings/1785936275585-approver-clause-gap-ci-green-on-sha-passed-on-a-co.md
---

# [approver/clause-gap] ci_green_on_sha passed on a CodeRabbit-only combined status while 4 builds failed — the D2 defect fired for real on slangpy#1090 R2

## Symptom

The predicted failure mode in
`[approver/clause-gap] ci_green_on_sha reads combined status only…` **actually fired**,
on a commit that was simultaneously the subject of a `BLOCK`.

shader-slang/slangpy#1090 @ `bb870c1750ccb4a24e0d3e072f17951df819469e`:

- recorded `clauses.json` → `ci_green_on_sha` = **pass**
- `GET commits/{sha}/status` → `{"state":"success","n":1}`, and that **one** context is
  **`CodeRabbit`** — a review bot. No build context whatsoever.
- `GET commits/{sha}/check-runs?per_page=100` → `total=18`, returned 18:
  **11 success, 4 failure, 3 skipped**. The 4 failures are all real build legs:
  `build (linux, x86_64, gcc, Debug/Release)`, `build (windows, x86_64, msvc, Debug/Release)`.

So the eligibility clause certified "CI green" on the word of a review bot while four
build legs were red — and those same four failures were the **evidence for the BLOCK**
being recorded in the same workspace. The clause and the verdict read opposite facts
about one commit.

Earlier prediction was that the defect was inert under `require_ci_green:false`. This
run used `v0-shadow-wide`; the clause reported `pass` on substance, not a
policy-skip — so the surviving-in-shadow assumption was too generous.

## Why the decision was still right

The BLOCK did not rely on the clause. The session read job logs directly through the
skill's own `tmp/ci-logs.py` and cited
`job 92307324577 → 1 failed, 4139 passed`, `job 92307324755 → 1 failed, 5678 passed`,
etc. Routing around a broken clause with a stronger primary source is what saved it.

That is the real lesson: **a green clause did not stop a correct BLOCK only because a
human-driven path ignored the clause.** Had the pipeline trusted `ci_green_on_sha`, a
red-build commit would have been certified eligible. The verdict path and the
eligibility path must not disagree silently — a clause contradicting the review
evidence in the same workspace should itself be a hard stop.

## How to catch it

Cross-check the clause against check-runs whenever `ci_green_on_sha` says pass:

```bash
gh api "repos/$R/commits/$S/status"                  --jq '{state,n:(.statuses|length)}'
gh api "repos/$R/commits/$S/check-runs?per_page=100" --jq \
  '"total=\(.total_count) returned=\(.check_runs|length)",
   ([.check_runs[]|.conclusion//.status]|group_by(.)|map({k:.[0],n:length}))'
```

Two red flags, both present here: `.statuses[]` contains **no build context**, and
`check_runs` contains `failure`. Always print `total_count` vs returned length —
this endpoint pages at 30 and a short count silently under-reports failures.

## Fix

As previously filed, now with a fired instance to justify priority: consult both
surfaces; require every required check-run `completed` with
`conclusion ∈ {success, skipped, neutral}`; treat *no build signal on either surface*
as `unevaluable`, never `pass`. Additionally — **fail loudly when the clause result
contradicts the review evidence in the same decision**, because that disagreement is
detectable at record time and is the cheapest possible tripwire for this class of bug.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785936275585-approver-clause-gap-ci-green-on-sha-passed-on-a-co.md`_
