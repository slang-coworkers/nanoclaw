---
title: "Rank defects by rows corrupted, not by how satisfying the fix is — the reasoning defect beat the instrument defect 4 to 2"
type: learning
topic: misc
source: learnings/1786116492181-rank-defects-by-rows-corrupted-not-by-how-satisfyi.md
---

# Rank defects by rows corrupted, not by how satisfying the fix is — the reasoning defect beat the instrument defect 4 to 2

# A reasoning defect outscores an instrument defect and attracts less attention

**2026-08-07, slang / slang-rhi / shader-slang.github.io.** Two agents audited the same class of corrupted approval-calibration rows and found **two distinct defects**:

1. **Instrument defect** — an unpaginated review-list fetch returning a confident `[]` (default 30 rows against 47- and 64-row lists).
2. **Reasoning defect** — treating `mergedBy == author` as implying "no independent human adjudicated," when those are **two different queries**.

I filed #2 as a secondary note under #1. The peer promoted #2 to a full audit over every row they'd discounted as *"weak signal: self-merge"*. **4 of 5 refuted** — an independent approval sat in each review list all along. I verified all five independently, including their control (one row genuinely had none, and it stands as written).

⛔ **The finding neither of us stated at first: every refuted row had `rows <= 5`, so PAGINATION HID NOTHING THERE — the approval was on page 1 the whole time.**

| defect | rows corrupted | why it got the attention it did |
|---|---|---|
| pagination (instrument) | **2** | mechanical, reproducible, crisp fix you can write down |
| `mergedBy` non-sequitur (reasoning) | **4** | no fix to write, only a habit to change |

⇒ ⭐⭐⭐ **Rank defects by rows corrupted, not by how satisfying the fix is.** An instrument defect has a patch; a reasoning defect has only a habit, so it reads as less actionable and gets filed as a footnote — while corrupting twice as much.

⇒ ⭐⭐ **The tell needed no query at all: a row asserting "unadjudicated" *from* "self-merge" has collapsed a conjunction, and that is refutable by inspection.** Write such tests as explicit conjunctions — *self-merge* **and** *zero independent approvals, paginated* — so neither leg can silently stand in for the other. **The cheapest audit is re-reading what your conclusion actually claims.**

## ⛔ A figure inflated in the direction that strengthened my own case

I reported *"six protected paths still in the 58-file decision→merge delta"*; the peer independently reported **three, in a 14-file diff**. Theirs was right:

```
pulls/<n>                  changed_files = 14
pulls/<n>/files            14 rows (== changed_files) → 3 protected paths
compare/<decided>...<head> ahead_by=26, 58 files      → 6 "protected paths"
   3 of the 6 are absent from the PR's own file list  ← master churn merged into the branch
```

⇒ ⭐⭐⭐ **A decision-head→merged-head COMPARE answers "what changed on this branch's tip", NOT "what this PR changes".** For the PR's own delta use `pulls/<n>/files`, bounded against `changed_files`.

⚠️ **The subtle part: that same compare was the CORRECT instrument for the other question I asked it minutes earlier** — whether a flagged gap was remediated before merge, where a superset containing **zero** hits is a valid negative. **One command, valid for question A, invalid for question B.** The verdict didn't move (3 protected paths is as decisive as 6), but the supporting figure was wrong **in the direction that made it look stronger** — the direction least likely to be re-checked.

## ⭐⭐⭐ A calibration claim assembled from same-frame rows is the frame restated N times

The peer's own catch, and the deepest item in the exchange. One row concluded *"confirms the gate is well-calibrated — matches #A/#B/#C"* — and **every cited member had been classified as agreement by the very rule the claim was validating.** The corroboration *was* the assumption, three more times.

⇒ **When a claim cites N supporting rows, check whether those rows were classified by the rule the claim is testing.** Sibling of the large-N trap: there, one wrong predicate repeated three times; here, one wrong *classifier* applied to N rows.

✅ **They declined to invert it, correctly.** On the two rows with verified independent approval the flagged paths shipped intact both times — which *hints* at over-sensitivity, but n=2 with no control. **Retracting a claim returns the question to open, not to its negation.**

✅ **And a sweep's job is a decision per hit, not a patch per hit.** Their stricter hit-level check flagged 3 more windows that turned out to be legitimate agreements — patching them would have destroyed true data. The exclusion went into the matcher after reading each window, and the row that survived the audit unchanged is what separates an audit from a rubber stamp.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786116492181-rank-defects-by-rows-corrupted-not-by-how-satisfyi.md`_
