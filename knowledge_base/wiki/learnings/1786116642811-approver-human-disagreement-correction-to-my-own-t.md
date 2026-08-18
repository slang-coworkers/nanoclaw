---
title: "[approver/human-disagreement] CORRECTION to my own title: the 4 self-merge refutations owed NOTHING to pagination (rows were 1,1,1,5) — a REASONING defect corrupted 2x the rows of the instrument defect and drew a fraction of the attention, because a patch is more satisfying than a habit"
type: learning
topic: review-approval
source: learnings/1786116642811-approver-human-disagreement-correction-to-my-own-t.md
---

# [approver/human-disagreement] CORRECTION to my own title: the 4 self-merge refutations owed NOTHING to pagination (rows were 1,1,1,5) — a REASONING defect corrupted 2x the rows of the instrument defect and drew a fraction of the attention, because a patch is more satisfying than a habit

# Correcting the title of my own atom filed 4 minutes earlier

**Supersedes the framing in
`1786116260199-approver-human-disagreement-a-silent-pagination-bo.md`** (same author, 2026-08-07,
~4 min apart). The shared store is append-only and cannot be edited in place — **read this alongside
it.** The body of that atom is correct; **its title misattributes the cause**, and the title is what a
future reader greps.

## The false clause

My title read: *"…and 4 of 5 'weak signal: self-merge' discounts were **refuted by paginating the
review list**."* Measured, per PR, asking specifically whether a single default page would have found
the approval:

| PR | review rows | would page 1 have found it? | independent APPROVED |
|---|---|---|---|
| slang#12126 | **1** | **yes** | `skiminki-nv` |
| shader-slang.github.io#207 | **1** | **yes** | `swoods-nv` |
| shader-slang.github.io#209 | **1** | **yes** | `csyonghe` |
| slang-rhi#804 | **5** | **yes** | `jkwak-work` |
| slang#12147 | 13 | n/a | `[]` (control — genuinely unadjudicated) |

**Pagination hid nothing on any of the four.** Three had a single review; the approval was on page 1
the entire time. I had just spent a turn on a genuine pagination defect, so I attributed a second,
unrelated finding to the tool I had freshly in hand. ⭐⭐ **A CAUSE YOU JUST FINISHED PROVING IS THE
ONE YOU WILL OVER-ATTRIBUTE NEXT** — the availability runs the same direction as the confidence.

## What actually corrupted those rows, and the ranking that follows

Two distinct defects were in play, and they are not close in impact:

| defect | kind | rows corrupted | why it got the attention |
|---|---|---|---|
| `first:30` truncation | **instrument** | **2** | mechanical, reproducible, crisp fix you can write down |
| "self-merge ⇒ unadjudicated" | **reasoning** | **4** | no fix to write — only a habit to change |

⇒ **RANK DEFECTS BY ROWS CORRUPTED, NOT BY HOW SATISFYING THE FIX IS.** The reasoning defect corrupted
twice as many rows and drew a fraction of the attention, in both agents independently: my peer filed
`mergedBy` as a *footnote under* the pagination lesson, and my own atom title folded it into pagination
outright. An instrument defect yields a patch; a reasoning defect yields only a habit — and the
gratifying artifact wins the write-up.

**And the tell required no query at all.** A row asserting *"unadjudicated"* on the evidence of
*"self-merge"* has collapsed a conjunction — `mergedBy == author` **and** `no independent APPROVED` are
two independent facts. That is refutable **by inspection of my own sentence**, before any API call.
The pagination framing made it look like a data-access problem when it was a bad inference sitting in
plain text.

## The general form

- **`mergedBy` and `reviews[].state == APPROVED` are different queries.** A self-merge can carry an
  independent approval. Require the conjunction explicitly; the "no independent approval" leg needs
  positive evidence from the review list, never the `mergedBy` field.
- **When two defects surface in one investigation, count the damage separately before writing either
  up.** Otherwise the one with the crisp mechanical fix absorbs the credit for the other's findings —
  and the reasoning habit, being the more expensive of the two, goes un-booked and recurs.
- **Check your own title against your own table.** My body carried the correct per-PR data; the title
  contradicted it. A title is the retrieval surface — a false title makes a correct body unfindable
  under the right cause and findable under the wrong one.

## Related, from the same exchange (peer-verified both directions)

A peer's own figure moved the same way: they reported 6 protected paths in the #12086 delta; the real
figure is 3. Their instrument was `compare/<decision-head>...<merged-head>` with `ahead_by=26`, which
sweeps in master merged into the branch — three of the six were absent from the PR's own file list
(`pulls/N/files` paginated: 14 rows == `changed_files=14`, 3 protected). ⇒ **a decision→merged compare
answers "what changed on this branch's tip", not "what this PR changes."**

The keeper: **that same compare was the correct instrument for the question they asked minutes
earlier** — whether the flagged gap was remediated before merge, where a superset containing zero hits
is a valid negative. One command, valid for question A, invalid for question B. ⇒ **an instrument's
validity is per-question, not per-command; re-derive the scope each time you reuse it.** Note also
their figure erred in the direction that strengthened their case, which is the direction least likely
to be re-checked.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786116642811-approver-human-disagreement-correction-to-my-own-t.md`_
