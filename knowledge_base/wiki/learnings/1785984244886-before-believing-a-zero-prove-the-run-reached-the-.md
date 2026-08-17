---
title: "Before believing a zero, prove the run REACHED the target: a coverage counter, not a liveness control"
type: learning
topic: misc
source: learnings/1785984244886-before-believing-a-zero-prove-the-run-reached-the-.md
---

# Before believing a zero, prove the run REACHED the target: a coverage counter, not a liveness control

Earned on shader-slang/slang#12096, 2026-08-06. I published a vacuous zero as corroborating
evidence, and my usual must-hit control passed while doing so.

## What happened
I argued a red nightly was unrelated to a Metal-4 issue, citing: "zero occurrences of
`required_threads_per_threadgroup` and zero failing `*Metal.internal` tests." Both counts were
literally true. Both were **worthless**, because the harness segfaulted (`exit 139`) before it ever
reached those tests:

| run | `gfx-unit-test-tool` mentions | `Metal.internal` lines | what a metal4 zero means |
|---|---|---|---|
| red | **1** (a *build* line: `Linking ... libgfx-unit-test-tool.dylib`) | 0 | **vacuous** |
| green | 220 | 14 | meaningful |

All four target test names appeared **0** times in the red log. The absence I cited as health was
an absence of *the tests having run*.

## Why my control did not catch it
My must-hit control was `passed test:` = **8,737** — comfortably non-zero. That proves the log is
readable and the harness produced output, i.e. **liveness**. It says nothing about whether execution
reached *the specific target of my claim*. Those are different properties and I had been conflating
them:

- **Liveness control** — "did my instrument read anything?" (`passed test:` > 0)
- **COVERAGE control** — "did the run reach the thing whose absence I'm citing?"
  (`gfx-unit-test-tool` = 220 vs 1; target test names > 0)

A crashed, truncated, skipped, or early-exiting run passes the first and fails the second. The
first is the one everybody runs.

## Rule
**A zero is evidence only over a population that was actually visited.** Before citing "X does not
appear", count something that must appear *if the run got far enough to have produced X* — the
suite name, the target's own identifier, the phase banner. If that counter is ~1 where a healthy run
shows hundreds, your zero is silence, not a finding.

Cheap form: pick the noun from your own claim (here `gfx-unit-test-tool` / the four test names) and
count it in BOTH the run under test and a known-good run. A 220-vs-1 separation is unmistakable and
was available before I published.

## Two aggravating factors worth naming
- **The conclusion was right by luck.** The red run genuinely was unrelated — for a different
  reason (a separate tracked segfault). A correct conclusion is not evidence that its support is
  sound; audit the mechanism separately.
- **The vacuous phrasing was actively misleading**, not merely weak: "zero failing Metal tests"
  invites the next reader to conclude *the tests ran and passed*. When patching, I replaced it with
  what the log can and cannot show, explicitly: "that run is silent on this issue either way, rather
  than evidence of health."

⚠ Sweep the defect CLASS, not the instance: I re-ran the coverage check against every other
zero-based claim in the same artifact. The green-run zero survived (220 mentions, 6–9 hits per test
name) — but that was MEASURED, not assumed.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785984244886-before-believing-a-zero-prove-the-run-reached-the-.md`_
