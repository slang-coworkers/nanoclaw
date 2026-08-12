# Keying a CI flake cost tally on the RUNNER HOST over-counts when two defects share the box

## The mistake

I had a memory note claiming the SLANGWIN5 `spirv-val` defect (shader-slang/slang #12341) had cost
"2 evictions". To update the figure I grepped my durable action log for `SLANGWIN5` and got **52
rows** across 11 PRs. That looks like a dominant infra offender.

It is not. **Two independent defects live on the same host.** Opening each candidate eviction's
actual job list (`gh api repos/<r>/actions/runs/<id>/jobs`) showed:

| PR / merge-group run | failing job | actually caused by |
|---|---|---|
| 11667 / 30818074297 | `test-falcor`@SLANGWIN5 | #12145 Falcor, **not** #12341 |
| 12122 / 29674744925 | `test-falcor`@SLANGWIN5 | #12145 |
| 12148 / 30871671290 | `test-falcor`@SLANGWIN5 | #12145 |
| 12322 / 30957913120 | `test-falcor`@SLANGWIN5 | #12145 |
| 12246 / 30889533285 | `test-compile-regression`@SLANGWIN5 | #12341 ✅ |
| 12324 / 30904952059 | `test-compile-regression`@SLANGWIN5 | #12341 ✅ |
| 12252 / 30977814221 | `test-compile-regression`@SLANGWIN5 | #12341 ✅ (sole cause) |

Verified count: **3**, not 11 — and 4 of the 11 were a *different* tracked flake that merely
happened to be scheduled on the same box.

## Why it matters

A cost figure is what a maintainer uses to prioritize. "SLANGWIN5 caused 11 evictions" points at
*decommission the host*; "the spirv-val defect caused 3, the Falcor AV caused the rest" points at
two different fixes. The host name is a **coincidence of scheduling**, not a cause.

## The rule

**Key a flake tally on the SIGNATURE, never on the HOST** — and never on a grep over your own
free-text `reason` fields. Prose mentions conflate "this ran on X" with "X broke it". Confirm each
event by re-opening the run's job list and reading which job failed.

Corollary: `check-ci` in this repo is a **pure aggregator** — its log body lists every job with
`name: conclusion`. If exactly one entry is `failure` and the rest `success`, the eviction is 100%
attributable to that one job. That makes it a cheap, decisive attribution instrument; don't count
`check-ci` as an independent failure.

## Bonus probe defect from the same sweep

Grepping for the counter with `'\[[0-9]+/[0-9]+\]'` returned **zero matches on a log that contains
the counters** — the real format has inner spaces: `PASSING spirv-val [ 0 / 866 ]`. Taking that zero
at face value would have said "signature absent" and reclassified a known infra flake as a code
regression. When a signature probe comes back empty, print surrounding lines before believing it.
