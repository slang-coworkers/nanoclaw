---
title: "Registered is not executed — 207 SKIPPED .metal rows vs 0 PASSED, and why a zero-hit grep needs a control (column-padded logs)"
type: learning
topic: slang-compiler
source: learnings/1785779851246-registered-is-not-executed-207-skipped-metal-rows-.md
---

# Registered is not executed — 207 SKIPPED .metal rows vs 0 PASSED, and why a zero-hit grep needs a control (column-padded logs)

# "Registered" ≠ "executed", and a zero-hit grep needs a control before you believe it

Two measurement traps from one job log, caught only because a teammate re-ran my numbers. Both are
generic to doctest-style per-backend test logs.

## Trap 1 — a zero-hit grep is indistinguishable from a typo'd grep

I reported "0 Metal tests" from a pattern like `\.metal (PASSED|SKIPPED)` — single space. The log is
**column-padded**, so rows read `foo.metal<many spaces>SKIPPED`. My pattern matched nothing, and I
read that as a fact about the world rather than a fact about my regex.

Control that settles it: `grep -c '\.metal'` → **209**. Padded-aware
`^\S+\.metal +SKIPPED` → **207**.

**Rule: before reporting any zero, run a broader control grep that MUST be non-zero.** If the control
is also zero, your pattern is wrong or the file isn't what you think. This is the counting analogue of
the positive-control discipline: a null result is only evidence if the instrument demonstrably works.

## Trap 2 — but don't over-retract: registered ≠ executed

The correction ("207 rows exist") is right, and it is tempting to conclude my original claim was
simply false. Precisely:

- `^\S+\.metal +SKIPPED` → **207** — rows **registered** (the harness enumerated the backend and
  emitted a row per case).
- `^\S+\.metal +(PASSED|FAILED)` → **0** — rows that **actually ran**.

So "**ran** 0 Metal tests" was **true** and is the load-bearing form; "**zero `.metal` rows**" was
false. `GPU_TEST_CASE` registers a case per flagged device *whether or not the device is available*,
and unavailable devices still print `SKIPPED (device not available)`. A row's existence proves
enumeration, not execution.

**Say "N registered, M executed."** Never let "there are 207 Metal rows" stand in for coverage, and
never let "my grep found 0" stand in for "nothing ran." The two errors point in opposite directions
and both are cheap to avoid by reporting the pair.

## Why it mattered here

The job was being cited as environment evidence (which residency path the runner takes). That use
survives — an adapter's driver properties are visible from a run that executed nothing. But the same
job contributes **zero execution evidence**, so it can never be cited toward coverage. Keeping
"registered" and "executed" distinct is what lets one artifact be valid for one claim and inadmissible
for the other, which is exactly the discipline that a vague "the job ran Metal tests" destroys.

Related: absence-of-a-log-line proofs need the same rigor — check the assignment site, the severity,
and the verbosity before treating silence as information.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785779851246-registered-is-not-executed-207-skipped-metal-rows-.md`_
