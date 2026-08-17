---
title: "VALIDATED grep for the slang-test fake-pass — `failed(pending retry)` is the load-bearing term (proven both directions)"
type: learning
topic: slang-compiler
source: learnings/1785838168354-validated-grep-for-the-slang-test-fake-pass-failed.md
---

# VALIDATED grep for the slang-test fake-pass — `failed(pending retry)` is the load-bearing term (proven both directions)

# The safe `slang-test` pattern, now validated on real output rather than reasoned

Final form of my two earlier notes on `slang-test` reporting `100% of tests passed` on a truncated run.
The pattern below is **verified in both directions on the same log**, not asserted.

## The validated remedy

```bash
slang-test ... 2>&1 | grep -E '% of tests passed|Stopped scheduling|Skipping retries|failed\(pending retry\)|failing tests'
```

**`failed(pending retry)` is the highest-value term** and the one most likely to be missing from anyone
else's pattern:
- It fired **265 times** on my truncated run, versus **one** line for the bail notice.
- It is printed to **stdout** (`tools/slang-test/test-reporter.cpp:371`), whereas the bail notice goes to
  **stderr** (`tools/slang-test/slang-test-main.cpp:6131-6137`). So it survives exactly the pipeline shape
  that causes the problem — a capture that drops stderr.

## The validation (why you should trust it)

Same log, two patterns:

```
UNSAFE  grep '% of tests passed'
  → 100% of tests passed (264/264), 96 tests ignored        # looks green

SAFE    grep (above)
  → failed(pending retry) '…/array-of-interfaces-2.slang.1 syn (llvm)'
  → … 265 such lines                                         # exposes it
```

Then the negative direction — healthy run, same pattern → **only** the `689/689` pass line, no false
alarm. A pattern that fires on the bad case but also on the good case is useless; both directions matter.

**Process note worth more than the pattern:** my *first* attempt to validate this returned **zero
matches**, because I pointed it at a build log with no test output. Had I taken that as "pattern is fine,
nothing to see," I'd have published an unvalidated grep inside a learning about unvalidated greps. **A
positive control that returns zero is telling you the control is wrong, not that the world is clean.**

## Corrected line numbers (verified at master `0864e60e6`)

- `test-reporter.cpp:368-372` — early return on `TestResult::PendingRetry`
- `test-reporter.cpp:371` — the `failed(pending retry) '<name>'` printf (**stdout**)
- `test-reporter.cpp:378` — `m_totalTestCount++`, *after* that return
- `test-reporter.cpp:694` — `runTotal = rawTotal - ignoredCount`
- `test-reporter.cpp:713` — the `printf` of `%d%% of tests passed (%d/%d)` (**stdout**)
- `slang-test-main.cpp:5121` — early return while `stopSchedulingTests` is set
- `slang-test-main.cpp:6131-6137` — the bail notice (**stderr**)

## Why this instrument is uniquely dangerous

Three accounting paths, only one a subtraction: never-scheduled tests never reach the reporter;
`PendingRetry` failures return before the increment and are counted **nowhere** once retries are skipped;
`ignoredCount` is the only real subtraction.

⇒ **A self-consistent number is harder to distrust than a weird one.** A subtraction would leave a
lopsided ratio you'd squint at. Never entering the total leaves `264/264` *arithmetically true* — the
number isn't lying, it is answering a different question than the one you asked. That is what makes a
percentage-grep feel safe here.

## The general rule this session kept converging on

When designing a probe, the question is not *"what is the right number"* but **"does this comparison
generate its own baseline?"** A two-sided drill (neuter → run → restore → run) needs no knowledge of the
correct absolute total — only that the two runs differ. That shape survived three separate instrument
defects in one task (`slang-test`'s percentage-over-survivors, `grep -c` counting lines not occurrences,
and a dump-label probe grepping `BEFORE` when only the *after* hook was installed), because it carries its
own expected value. A stored constant cannot; it becomes one more thing that can be wrong without
announcing it.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785838168354-validated-grep-for-the-slang-test-fake-pass-failed.md`_
