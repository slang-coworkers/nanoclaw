---
title: "A cancelled job tested nothing — so it cannot corroborate 'retried and still failed'"
type: learning
topic: misc
source: learnings/1786136609115-a-cancelled-job-tested-nothing-so-it-cannot-corrob.md
---

# A cancelled job tested nothing — so it cannot corroborate "retried and still failed"

## The error

A note of mine (and a peer's contemporaneous memo) recorded a 2026-07-19 CI occurrence as
*"retried and still failed"* — read as strengthening a flake report. The re-fetchable record refutes it:

| object | figure |
|---|---|
| attempt-2 leg `88146460968` | `conclusion: **cancelled**` (not `failure`) |
| run `29664078557` overall | `conclusion: cancelled` |
| attempt-2 bucket | 34 `success` / 2 `cancelled` / **1 `failure` — and that one is `check-ci`** |

`check-ci` is a *reporter* job that goes red because a sibling did; it isn't a test result. So attempt 2
of that run **executed no test of the signature**. "Retried and still failed" was unsupported.

## The rule

**`cancelled` is not a weak `failure` — it is an ABSENCE of a result.** A cancelled attempt yields
**zero** information about reproduction. Specifically:

- It cannot corroborate "still failed on retry."
- It equally cannot support "cleared on retry."
- Counting it in a failure tally inflates the numerator; counting it in a denominator of "attempts that
  tested this" inflates the base rate's denominator with non-tests.

Same trap as `skipped`: both satisfy `status == completed`, so any filter keyed on `completed` sweeps
them in. Bucket **four** ways — `success` / `failure` / `cancelled`+`skipped` (UNTESTED) / non-terminal
— and compute ratios from `success + failure` only.

## Companion check for the opposite polarity

A `success` can be equally vacuous. Before crediting a green as "the flake cleared", confirm the test
step actually **ran**: attempt-2 job `92985510242` had 16 steps with `Test Slang = success` (real green),
whereas a `success` with `steps == 0` or the test step `skipped` proves nothing. **Print the step
outcomes before treating either polarity as evidence.**

## Meta — where this was caught

I found it while auditing the direction that *flattered* my own filing (a peer had asked me to *promote*
that row). The unflattering half of the audit is the half that pays: the promotion was valid for the
**leg** (check-run metadata outlives logs and re-fetches fine) but the "retried and still failed" clause
riding along with it was false. Audit the claim you *want* to be true at least as hard as the one you
don't — and post the correction into the public artifact rather than quietly dropping the clause.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786136609115-a-cancelled-job-tested-nothing-so-it-cannot-corrob.md`_
