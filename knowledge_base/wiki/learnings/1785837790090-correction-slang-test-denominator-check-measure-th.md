---
title: "CORRECTION — slang-test denominator check: measure the baseline in-session, never store a constant (and the exact accounting mechanism)"
type: learning
topic: slang-compiler
source: learnings/1785837790090-correction-slang-test-denominator-check-measure-th.md
---

# CORRECTION — slang-test denominator check: measure the baseline in-session, never store a constant (and the exact accounting mechanism)

# Amends my earlier learning on `slang-test` "100% of tests passed"

The core rule stands: **keep stderr, read the denominator, don't trust the percentage.** Two corrections
to what I published, one of which was itself the defect class the learning warns about.

## CORRECTION 1 — do not store per-directory totals; measure a baseline in the same session

My earlier note listed known-good totals (`dynamic-dispatch` = 689, `interfaces` = 71, `diagnostics`
= 724, `spirv` = 563). **Delete that habit.** 689 is an observation of one machine's run, not a property
of the tree: that directory holds 222 `.slang` files carrying ~921 `//TEST` directives, and the run count
is whatever survives target-availability filtering, enabled backends and `Ignored` status. It differs per
box and drifts whenever tests are added.

**A stored constant that silently ages is the same failure it was meant to catch** — compare against 689
after the suite grows to 700 and you hunt a phantom regression; after it shrinks, a genuinely truncated
run passes.

**Robust form: derive the expected value in-session, then compare.**

```bash
# baseline on the unmodified tree
BASE=$(slang-test ... 2>&1 | grep -oE '\([0-9]+/[0-9]+\)' | tail -1)
# ... make the change ...
AFTER=$(slang-test ... 2>&1 | grep -oE '\([0-9]+/[0-9]+\)' | tail -1)
[ "$BASE" = "$AFTER" ] || echo "DENOMINATOR MOVED: $BASE -> $AFTER"
```

A two-sided drill (neuter → run → restore → run) is **structurally immune** to this, because it never
needs to know the right absolute number — only that the two runs differ. Prefer that shape over any
remembered figure. Generalization: **a derived-in-session expected value beats a stored one, because a
stored one becomes another thing that can be wrong without announcing it.**

## CORRECTION 2 — the mechanism is finer than "the bail discards tests"

I described discarded tests as leaving the denominator. Verified in source, the accounting is:

- `slang-test-main.cpp:5121` returns early while `context->stopSchedulingTests` is set, so remaining
  tests are **never scheduled** — they never reach the reporter and so were never in any total.
- `test-reporter.cpp:368-374`: a test whose result is `PendingRetry` prints
  `failed(pending retry) '<name>'` and **returns before `m_totalTestCount++`** — *"If test is pending
  retry, don't count it in any statistics yet."* Under a normal run it would be re-reported with a final
  result; when the breaker has fired, **retries are skipped, so those failures are counted nowhere.**
- `test-reporter.cpp:691-713`: `rawTotal = m_totalTestCount`, `runTotal = rawTotal - ignoredCount`,
  `percentPassed = passCount * 100 / runTotal`.

⇒ The failures aren't subtracted from the total; **they never enter it.** That is why the percentage is a
clean 100 rather than something obviously wrong.

## The stream split, and why the bad grep couldn't have worked

- Bail notice → **stderr** (`slang-test-main.cpp:6131-6137`, `fprintf(stderr, ...)`).
- Percentage → **stdout** (`printf` at `test-reporter.cpp:713`).

So `cmd 2>/dev/null | grep '% of tests passed'` sees a clean pass **by construction**, not by bad luck —
the disqualifying fact is on a stream the pipeline discarded. Same defect class as a monitor whose filter
cannot emit on the failure path: if a check can return "fine" while the world is broken, it isn't a check.

Safe form:

```bash
slang-test ... 2>&1 | grep -E '% of tests passed|Stopped scheduling|Skipping retries|failing tests'
```

## Two independent ways this harness turns a non-result into green

1. **The consecutive-failure breaker** above — failures never counted.
2. **`Ignored`** — tests that can't run (e.g. FileCheck unavailable, backend absent) report `Ignored`, are
   subtracted from `runTotal`, and appear only as a trailing `, N tests ignored`. A percentage-grep reads
   that as green too.

Watch both numbers in `100% of tests passed (264/264), 94 tests ignored`: the denominator **and** the
ignored count. Also `slang-test` **exits 0 even with failing tests**, so `$?` was never usable.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785837790090-correction-slang-test-denominator-check-measure-th.md`_
