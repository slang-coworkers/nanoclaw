---
title: "gh run view --json jobs shows ONLY the latest attempt — it hid a real CI failure and made me retract a true report"
type: learning
topic: ci-tooling
source: learnings/1785992152145-gh-run-view-json-jobs-shows-only-the-latest-attemp.md
---

# gh run view --json jobs shows ONLY the latest attempt — it hid a real CI failure and made me retract a true report

Two things here: a concrete GitHub Actions API trap, and the reason it was more dangerous than an
ordinary wrong measurement.

## The trap

`gh run view <id> --json jobs` and `GET /repos/{o}/{r}/actions/runs/{id}/jobs` return **only the latest
attempt**. If a job failed on attempt 1 and someone re-ran it green, the failure is **structurally
invisible** to those calls.

I had correctly reported a Falcor CI failure on my PR head. Later, checking myself, I ran
`gh run view 31047790392 --json jobs`, saw `Test (Falcor) = SUCCESS`, and **retracted a true report.**

```bash
# the tell that history exists at all:
gh api repos/<o>/<r>/actions/runs/<id> --jq .run_attempt          # > 1 ⇒ a re-run happened

# read the attempt you actually mean:
gh api repos/<o>/<r>/actions/runs/<id>/attempts/1/jobs
```
Real numbers from that run (`run_attempt: 2`):
- attempt 1 → `Test (Falcor)` **FAILURE**, job `92454170957`, runner SLANGWIN4,
  `test_GBufferRTTexGrads_d3d12 : FAILED`, `Mogwai.exe exited with return code 3221225477` (=`0xC0000005`)
- attempt 2 → same job **SUCCESS**, job `92467419265`

A returned job also carries `run_attempt`; if it reads `2`, you are not looking at the original outcome.

## Why the retraction was the dangerous part

**An over-retraction costs as much as an over-claim and is much harder to catch, because retracting
reads as rigour and nobody argues you into keeping a claim.** When you withdraw something, the whole
social gradient is with you — it looks humble and careful, and no reviewer pushes back the way they
would on an assertion. So the disconfirming probe deserves *more* scrutiny than the original claim:
**can this instrument even represent the thing I am now saying is absent?** Mine could not, so the
negative result was guaranteed regardless of the truth.

⚠️ It also arrived wearing the clothes of a mistake I had **already admitted** earlier in the same
session (confusing two similarly-named jobs, `Test (Falcor)` vs `Test (Falcor Perf)`). Having fixed
that one, "I misread the job" was a ready-made explanation and I accepted it. **Two different failure
modes can produce the same surface symptom; the fix for one is not evidence about the other.**

## Bonus: the invisible attempt was the best evidence in the run

Same head, attempt 1 FAILED and attempt 2 PASSED ⇒ code constant, outcome changed ⇒ a **same-SHA
pass/fail pair**, which is exactly the categorical evidence a flake investigation wants. The endpoint
that hid the failure also hid the proof. **When an API collapses history, you lose the comparison, not
just a data point.**

## Companion rule, cheaper than everything above

**"Does someone already own this failure?" — one `gh issue list` on the signature, before any control.**
I spent an hour proving a failure was not caused by my change while it was a known, tracked issue with
8 prior occurrences. **Proving-it's-not-mine and finding-who-owns-it are different questions, and the
second is cheaper.**

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785992152145-gh-run-view-json-jobs-shows-only-the-latest-attemp.md`_
