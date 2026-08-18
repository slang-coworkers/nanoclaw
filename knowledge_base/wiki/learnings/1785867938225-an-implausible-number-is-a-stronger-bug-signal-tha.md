---
title: "An implausible number is a stronger bug signal than re-reading your filter code"
type: learning
topic: misc
source: learnings/1785867938225-an-implausible-number-is-a-stronger-bug-signal-tha.md
---

# An implausible number is a stronger bug signal than re-reading your filter code

## The incident

Auditing 7 days of CI rerun history, I had already recorded the rule *"the log's `action:"rerun"`
field means CONSIDERED, not DONE — exclude declines."* I then re-derived the number with a fresh
decline filter: `result == "left"`. Result: 29 reruns / 21 PRs, and **one PR credited with 17 reruns
in 7 days under a 3-per-day cap.**

17 under a 3/day cap is near-arithmetically impossible. That implausibility — not any code review —
sent me to inspect the rows. Every one of the 17 was a decline. `result` turned out to be an
**11-value open vocabulary**: `left` 67, `declined` 61, absent 15, `blocked` 4, `moot` 4, `resolved`
3, `requeued` 2, `cleared` 1, `merged` 1, `reran` 1, `deferred` 1. Filtering the single value I
happened to have seen leaked the other 7 non-action values. Correct count: **14 real reruns / 13 PRs**
— my leaky filter was off by 2×, on top of the ~11× error the raw field gives.

## Rules

1. **Deny-list the non-actions; never allow-list one.** Enumerate the field's actual value
   distribution before filtering on it — `Counter(r.get('result','<absent>'))` costs one line and
   would have shown all 11 values immediately.
2. **Sanity-check a derived count against a known constraint.** A cap, a total, a physical limit. The
   check that caught this was "does 17 fit under 3/day?", not "is my predicate right?"
3. **Pair the filter with a known-nonempty control:** an action you *just performed and verified*
   MUST survive the filter. Any zero convicts the filter as too strict. (Mine passed on re-run —
   today's verified rerun appeared.)
4. **Keeping the RULE but not the VALUE forces re-derivation, and fresh error enters there.** I wrote
   the "excludes declines" rule and still got the number wrong the second time, with a different bug.
   Store the value, its date, and its method next to the rule: *14 real reruns / 13 PRs, 7d to
   2026-08-04, method = distinct `(pr, run_id)` with the 8-value non-action `result` set excluded.*

## Why it's invisible without the plausibility check

A too-strict or too-loose filter produces a **wrong sense of coverage**, not a wrong-looking answer.
Every output parses, every row is real, nothing throws. Outcome-checking cannot see it. The only cheap
detectors are an external constraint the number must satisfy, and a control case whose answer you
already hold.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785867938225-an-implausible-number-is-a-stronger-bug-signal-tha.md`_
