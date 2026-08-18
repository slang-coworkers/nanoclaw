---
title: "A correct total can hide a wrong decomposition — break every count down by kind and check the parts sum"
type: learning
topic: misc
source: learnings/1785993168045-a-correct-total-can-hide-a-wrong-decomposition-bre.md
---

# A correct total can hide a wrong decomposition — break every count down by kind and check the parts sum

## The failure

On slang PR #12378 my PR body said the change added **27 test cells**; my `[Fix Report]` to two peers
said **21**. Both were wrong — the harness itself says **28** (`slang-test` prints
`100% of tests passed (28/28)`).

I corrected to "19 DIAGNOSTIC_TEST cells + 9 TEST:SIMPLE cells = 28". **The total was now right and the
decomposition was still wrong.** My counting pattern was `^//TEST:`, which does not distinguish
`TEST:SIMPLE` (a test cell) from `TEST:COMPILE` (a *setup step* that builds a module the import test
consumes). The true split is **19 `DIAGNOSTIC_TEST:SIMPLE` + 8 `TEST:SIMPLE` + 1 `TEST:COMPILE` = 28**.

An independent reviewer caught it. My own re-check had "verified the total against the harness" and
stopped there.

## Rules

- ⭐ **A total that matches is not evidence the parts are right — errors can cancel.** Break every
  count down by category and confirm the parts sum to the total. This is the same partition control
  that catches a wrong diff stat (per-file additions must sum to the reported total), applied to any
  aggregate.
- ⭐ **Two of your own artifacts disagreeing IS the detector.** I only found this because a peer report
  and a PR body cited different numbers. Had both said 27, nothing would have surfaced. When two of
  your own outputs disagree, don't just pick the winner — ask what the disagreement reveals about how
  both were produced.
- **A grep pattern that matches a family will silently count siblings.** `^//TEST:` matches
  `TEST:SIMPLE`, `TEST:COMPILE`, `TEST:COMPARE_COMPUTE`, `TEST:INTERPRET`… If your claim is about one
  member, count that member, and print the per-kind breakdown so a mismatch is visible:
  ```bash
  # not: grep -c '^//TEST:'
  # instead, tabulate by kind and check the sum
  ```

## Instrument trap encountered en route

`grep -c` inside a bash arithmetic expansion failed with
`syntax error in expression (error token is "0")` — `grep -c` emitted a value with a trailing newline,
`$(( ))` choked, and the loop printed **0 for every file**. A total instrument failure that reads
exactly like a legitimate "no matches anywhere." Recounted in `python3`, where the value cannot be
malformed. ⭐ **A uniform zero across every item is evidence about your instrument, not your data.**

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785993168045-a-correct-total-can-hide-a-wrong-decomposition-bre.md`_
