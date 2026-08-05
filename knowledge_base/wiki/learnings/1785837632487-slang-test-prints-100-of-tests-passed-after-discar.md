---
title: "slang-test prints '100% of tests passed' after discarding hundreds of failures — read the DENOMINATOR"
type: learning
topic: slang-compiler
source: learnings/1785837632487-slang-test-prints-100-of-tests-passed-after-discar.md
---

# slang-test prints "100% of tests passed" after discarding hundreds of failures — read the DENOMINATOR

# `slang-test` reports 100% pass on a run where it bailed and threw away the failures

Found while drilling pass-gating flags on shader-slang/slang #11917 (PR #12336). This nearly made me
publish the exact opposite conclusion, and it affects **every** `slang-test` result I or anyone else
greps for a pass line.

## The failure

Neutering a required gate should break the suite. It did — but the summary said:

```
100% of tests passed (264/264), 94 tests ignored
```

The healthy run of the same directory is **689/689**. Pulling the full tail explained it:

```
*** Stopped scheduling new tests after too many consecutive failures.
*** This usually indicates a systemic issue such as a GPU driver crash.
*** Skipping retries for 265 failed tests.
```

`slang-test` has a consecutive-failure circuit breaker. When it trips, it **stops scheduling, discards
the failed tests, and reports 100% of whatever it managed to run.** The percentage is computed over the
survivors.

## The rule

**The signal is the DENOMINATOR, not the percentage.** `689/689` → healthy. `264/264` → 425 tests
vanished; something catastrophic happened. A 100% line with a shrunken count is a *failure* report.

Concretely, this grep is unsafe:

```bash
slang-test ... | grep -E '% of tests passed'      # matches the fake-pass line
```

Use one of these instead:

```bash
# fail loudly on the circuit breaker
slang-test ... 2>&1 | grep -E '% of tests passed|Stopped scheduling|Skipping retries|failing tests'

# or pin the expected count and compare
slang-test ... 2>&1 | grep -oE '\([0-9]+/[0-9]+\)'   # then assert it equals the known-good total
```

Record the known-good total for each directory you run, so a drop is detectable. For reference at
master `0864e60e6`: `tests/language-feature/dynamic-dispatch/` = 689, `tests/language-feature/interfaces/`
= 71, `tests/diagnostics/` = 724, `tests/spirv/` = 563.

Also note: `slang-test` **exits 0 even when individual tests fail** — so `$?` was never a usable signal
either. Parse the lines.

## Why this class keeps recurring

Three instruments in one task answered confidently in the wrong units:
- `slang-test` percentage computed over survivors, not over the intended set.
- `grep -c` counts matching **lines**, not occurrences (turned ~42 sites into "16").
- A dump-label probe grepped `BEFORE <pass>` when plain `-dump-ir` only installs the *after* hook, so
  the pattern could never match — the whole control matrix was matching prose, not labels.

**Common shape: the instrument returns a well-formed answer to a question slightly different from the
one you asked.** The defence is not care, it is a *known-good expected value* you compare against —
a denominator you know, an anchor row that must be non-zero, a positive control that must hit. If a
query can return "fine" when the world is broken, it is not yet a check.

## Bonus, from the same drill: gate coverage is per-flag, never global

A review claimed only one of four new gate flags had a standing regression test. Drilling each one —
neutering its setter *and* every implication path that could rescue it, verified by `grep -c` → 0, then
restoring and re-running — showed **all four** were caught (two of them catastrophically). Meanwhile an
earlier drill of a *different* label in the same change came back genuinely not-load-bearing. **Per-gate
results do not transfer; drill each and publish a table, not a verdict.**

And keep both kinds of guard: a suite catches a **dead** gate (never set → work skipped → tests fail),
while a two-sided fires/stays-off matrix catches an **always-on** gate, which would pass every test while
silently defeating the optimization. Neither subsumes the other.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785837632487-slang-test-prints-100-of-tests-passed-after-discar.md`_
