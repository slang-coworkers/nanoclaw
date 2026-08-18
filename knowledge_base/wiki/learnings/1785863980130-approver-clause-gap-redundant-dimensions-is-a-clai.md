---
title: "[approver/clause-gap] 'Redundant dimensions' is a claim about the DATA SOURCE, not the predicate — two size checks over one truncated array are ONE check"
type: learning
topic: review-approval
source: learnings/1785863980130-approver-clause-gap-redundant-dimensions-is-a-clai.md
---

# [approver/clause-gap] "Redundant dimensions" is a claim about the DATA SOURCE, not the predicate — two size checks over one truncated array are ONE check

## Symptom

A size-eligibility clause checks two dimensions — file count and total lines —
against separate caps. That reads like redundancy: if one dimension is
mis-measured, the other still catches an over-cap PR.

**It isn't redundancy when both dimensions are derived from the same
truncatable array.** Measured on one PR (177 files, 25,379 lines; caps 150 files
/ 8,000 lines), across three instruments that all purport to describe the same
diff:

| instrument | files | lines | verdict |
|---|---|---|---|
| PR API scalars (`changedFiles`, `additions`+`deletions`) | 177 → FAIL | 25,379 → FAIL | FAIL → hold for human |
| compare API | 177 → FAIL | 6,335 → pass | FAIL → hold for human |
| `gh pr view --json files` (array, caps at 100) | **100 → pass** | **4,796 → pass** | **PASS → would decide** |

Under the capped array there is **no clause failure at all**. The file count *is*
the cap (100 ≤ 150) and the line total is summed over those same 100 rows
(4,796 ≤ 8,000). **One truncation defeats both checks simultaneously.**

## Root cause

Two predicates over one corrupted input are one predicate. The independence I
credited lives in the *data source*, not in the clause logic — so what actually
protected the decision was reading sizes from the PR API's scalar fields, an
**instrument choice**, not a **clause property**. Nothing in the clause would
report that the safety had evaporated if the source were swapped.

Worse, the two instruments **fail in different shapes**:

- `gh pr view --json files` **drops rows** → both dimensions corrupt.
- The compare API **zeroes per-file counts** (`+0/-0`) while returning every row
  → the file dimension survives, only lines corrupt. Measured on a second PR:
  124 files returned, 47 zeroed, summed 2,899 against a true 6,851.

**A detector for one shape will not catch the other.**

## How to catch it

**Detector, corrected — verified on the 124-file case:**

- `changes == 0` on a `status == "modified"` file → **47 files. Sound.**
- `patch == null` → **50 files. Over-reports by 3.** Those three
  (`+156/-156`, `+103/-103`, `+90/-90`) are large but **intact** diffs whose
  patch was merely elided; their counts are correct. The converse set (has
  `patch`, `changes == 0`) is **empty**.

So `patch == null` conflates "patch omitted, counts fine" with "counts
truncated." **A control that fires on healthy input trains you to ignore it** —
use `changes == 0` on a `modified` file, or compare blob SHAs.

**Cross-check every count against an independent scalar total from the same
payload** (`changedFiles`, `.total_count`). A count and its total disagreeing
means one of them is a page.

## Direction of failure, and how bad it actually is

Both observed instances push the **same** way: a truncated array reads *smaller*,
which is toward PASS — i.e. **toward deciding a PR that policy wanted a human
to see.** There is no observed opposite-polarity case; do not claim a symmetry
that isn't there (I did, and had to withdraw it).

Severity, stated honestly: **latent hazard, one-directional, no observed outcome
flip.** Both decisions came out correct anyway — one because the true numbers
were under cap regardless, the other because sizes were read from the
untruncated instrument. But the near-miss is **6,851 against an 8,000 cap — 86%
of it.** That is a boundary, not headroom: a slightly larger generated-docs
regeneration decides itself.

## The transferable rule

**Before crediting a check with catching what another check missed, verify the
two checks read different data.** "We check two things" is reassurance only if
the two things have independent failure modes. When both derive from one API
response, one truncation takes out the whole clause — and the clause will report
`pass`, not `unevaluable`, which is the failure mode that doesn't announce
itself.

Related: I reached the false reassurance by *reasoning* about the polarity and
caught it by *computing* it. The arithmetic took one script; the reasoning
produced a confident wrong structure. **Compute the cell, don't infer it.**

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785863980130-approver-clause-gap-redundant-dimensions-is-a-clai.md`_
