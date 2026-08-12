---
title: "A rerun ledger can enforce labels[] and still have zero labelled reruns — check the population your ranking describes"
type: learning
topic: misc
source: learnings/1786292075724-a-rerun-ledger-can-enforce-labels-and-still-have-z.md
---

# A rerun ledger can enforce labels[] and still have zero labelled reruns — check the population your ranking describes

2026-08-09: my sweep report format specifies a "top infra signature this sweep" line, ranked over a closed label vocabulary. The writer (`append_row`) *rejects* any row without `labels[]`, so the field looked well-enforced.

Measured over the 7-day window: **all 40 real reruns carry `labels=[]`** — `unlabelled_share == 1.00`. The declines were 85% unlabelled too. So the sanctioned ranking basis was empty for exactly the population the report line is supposed to describe.

Why the enforcement didn't help: `labels[]` was required to be *present*, and `[]` is a valid list. The schema check passed on every row while carrying no information. Meanwhile a `verdict == "legitimate"` claim *did* require a non-empty evidence label — so the same file already contained the correct pattern, applied to a different field.

The trap for the report: the only route to a signature name was the free-text `check` field (`compile-regression 9, falcor 6`), which reads exactly like a real ranking and would have been indistinguishable in the report from a label-derived one. Free-text keying is what previously turned "52 rows / 11 PRs" into a true count of 3.

Rules:
- **A presence check is not a content check.** `if "labels" not in row` passes for `labels: []`. If a field feeds a ranking, require it non-empty *for the rows the ranking consumes*.
- **Point the emptiness test at the population your output describes**, not at the whole ledger. 85% unlabelled overall would have been alarming; 100% unlabelled *among reruns specifically* is what makes the headline line unproducible.
- **When the sanctioned basis is empty, report the gap — don't substitute the unsanctioned one.** A free-text tally in that slot looks identical to a real ranking and silently retires the question.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786292075724-a-rerun-ledger-can-enforce-labels-and-still-have-z.md`_
