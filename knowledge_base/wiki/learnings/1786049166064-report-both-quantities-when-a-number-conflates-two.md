---
title: "Report BOTH quantities when a number conflates two — '2 log lines, affecting 1 distinct test' is readable; '2' is not, and no amount of care recovers the difference"
type: learning
topic: misc
source: learnings/1786049166064-report-both-quantities-when-a-number-conflates-two.md
---

# Report BOTH quantities when a number conflates two — "2 log lines, affecting 1 distinct test" is readable; "2" is not, and no amount of care recovers the difference

## The situation

I was tracking how often a new compiler warning fired during a `slang-test` run with
`grep -c 'warning\[E38208\]' <log>`. The count moved 1 → 2 and I briefly read it as a second test
firing. It wasn't: **the retry phase re-prints each failing test's `EXPECTED/ACTUAL` block**, so both
occurrences were the *same* test, printed twice.

That's the third distinct way one grep misled over the same log:

| defect | effect |
|---|---|
| matches a test's own **annotation text** inside its `EXPECTED` block | false positive — counted a warning in an arm where the code didn't exist |
| **omits passing tests' output** entirely (`dumpOutputDifference` runs only on the fail branch) | counts *failures caused by* the warning, not *firings* |
| retry phase **re-prints** failing tests' output | occurrence counts inflate monotonically with retries |

⚠ **The duplication defect is direction-agnostic.** It happened to inflate a number that made my change
look *worse*, and I filed that as "safely pessimistic" — wrong. The mechanism re-prints whatever it
re-runs, so it would inflate a figure favouring the change identically. Classifying an error as benign
from *its instance* rather than *its mechanism* is the same failure as any other single-sample
inference.

## The fix that generalizes

The weak fix is to compute the right quantity. The strong fix is to **report both, with labels**:

```
warning[E38208]: 2 log lines, affecting 1 distinct test file(s)
```

⭐ **A single conflated number cannot be read correctly by even a careful reader — the information
isn't in it.** Reporting both makes the divergence self-announcing the moment it appears, instead of
waiting to be noticed by someone who happens to re-read output they had no reason to distrust.

This is the same move as stamping scope into a table's **column header** rather than a paragraph above
it: **put the qualifier where the value is read, not where you hope the reader looks first.**

## Practical rule

For any count over a log, name the unit before trusting it: *occurrences*, *lines*, *distinct tests*,
*distinct files*? If two plausible units could give different answers, print both. And characterize
the population first — a log is a **filtered and duplicated** view of reality, shaped by the tool's
reporting policy rather than yours.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786049166064-report-both-quantities-when-a-number-conflates-two.md`_
