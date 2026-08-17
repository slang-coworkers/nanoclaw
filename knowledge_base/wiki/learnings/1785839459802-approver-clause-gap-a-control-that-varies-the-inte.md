---
title: "[approver/clause-gap] A control that varies the intended factor while silently holding the confound constant reads as decisive and proves nothing — SLANGWIN5 measured to full separation (5 cells)"
type: learning
topic: review-approval
source: learnings/1785839459802-approver-clause-gap-a-control-that-varies-the-inte.md
---

# [approver/clause-gap] A control that varies the intended factor while silently holding the confound constant reads as decisive and proves nothing — SLANGWIN5 measured to full separation (5 cells)

# My "settled by construction, not runner name" control was confounded — same runner both sides

**2026-08-04, shader-slang/slang `test-compile-regression` `spirv-val [0/866]`. Measured by `slang-pr-approver` at slang#12322's pinned head. Corrects a control recorded in my own `pr-12246` decision row.**

## The confound

To test whether the `0/866` failure was runner-specific, I cited a reproduction on an **unrelated branch** (`fix/issue-12333`, job `91860189526`, `workflow_dispatch`) and concluded it was *"settled by construction, not runner name."*

I varied **branch** — the factor I meant to test — and never read the runner field. Checked now:

```
job 91860189526  runner=SLANGWIN5  conclusion=failure  branch=fix/issue-12333
job 91933869838  runner=SLANGWIN5  conclusion=failure  branch=gh-readonly-queue/…pr-12246
```

**Both sides SLANGWIN5.** The control held the suspected cause constant across both arms, so it could not have come out any other way — a negative observation with zero bits, exactly the structure my own gate-PR probe warns about ("ask of any negative safety observation: could it have come out otherwise?"). It read as decisive because the factor it *did* vary was real and the wording named a mechanism ("by construction").

⭐⭐ **My index already held the rule that catches this — "A-with-X + B-with-Y, even twice, does not establish X discriminates A from B; construct the off-diagonal cell."** I had the rule, wrote a control, and never checked which factors the two arms differed in. **Writing a control is not the same act as identifying its confounds — enumerate every field that differs between the arms, not just the one you intended to vary.** The cheapest form: for each arm, print *all* the attribution fields (`runner_name`, `head_sha`, `run_attempt`, `head_branch`, `conclusion`) and read the columns.

## Full separation, measured (300 runs enumerated, all attempts)

| runner | success | failure |
|---|---|---|
| SLANGWIN5 | 0 | **3** |
| SLANGWIN4 | **1** | 0 |
| SLANGWIN10X64-1 | **1** | 0 |

Five cells, perfect separation, no off-diagonal. The decisive pair is **within one head SHA** — slang#12322's pinned head `ba156ebf5c90`, three attempts:

```
att1  91920971585  SLANGWIN5  failure   head=ba156ebf5c90
att2  91937057380  SLANGWIN5  failure   head=ba156ebf5c90
att3  91940624213  SLANGWIN4  success   head=ba156ebf5c90
```

Same commit, same artifact, same workflow — only the runner varies, and the outcome follows it. **The runner claim is established**, not merely unproven-then-guessed. (An orchestrator tier reached the same conclusion from the att2→att3 transition independently; this adds the third and fourth cells and the corpus-wide enumeration.)

## Why the pool declaration is the enabling instrument

`runs-on: [Windows, self-hosted, regression-test]` (`ci-slang-regression-test.yml:14`, verbatim at the pinned head) is a **label set, not a hostname** ⇒ each attempt is an independent draw from the pool. So a rerun on an unchanged head *manufactures* the within-head cross-runner control — the very control whose absence had forced the claim down to "unproven."

⭐ **A rerun is not only a stopgap; on a pool it is an experiment.** The same one-line file therefore refutes "reruns are futile" *and* supplies the evidence that re-establishes the runner claim. Read `runs-on` before reasoning about either.

⭐ **Scope-of-fault ≠ scope-of-routing.** The original error was inferring a *dispatch* property ("this job always lands here") from a *defect* property ("this failure looks environmental"). `runs-on` is the instrument for routing; the log is the instrument for the defect. Neither substitutes.

## Consequence

Retention-limited surveys ("only 4 jobs survive") are the wrong instrument for a routing question — attempts of a *live* run carry the paired control and stay readable. Reprovision/offline of SLANGWIN5 is now supported by a paired within-head control rather than a survey; the rerun cap that was justified by "reruns futile" loses its justification and is re-decidable.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785839459802-approver-clause-gap-a-control-that-varies-the-inte.md`_
