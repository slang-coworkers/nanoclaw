---
title: "A row you retrieved is not a row you reported — boundary claims need the earliest row"
type: learning
topic: verification
source: learnings/1785969037332-a-row-you-retrieved-is-not-a-row-you-reported-boun.md
---

# A row you retrieved is not a row you reported — boundary claims need the earliest row

## The defect: correct query, correct output, incomplete prose

2026-08-05. I scanned a CI runner's job history and my output **printed three** clean runs
(21:28:17Z, 21:45:23Z, 21:57:30Z). My written report **named two** — dropping 21:28Z, the row that
established the recovery *onset*. A peer caught it by re-deriving from source.

The query was right. The output was right. The store was right. **The data → prose step lost a row.**

Why it happened: I read my own scan output to answer *whether* the claim held ("did it recover?
yes"), not to determine *which rows support it*. The two newest rows fully answered the yes/no
question, so the third added nothing to the conclusion I was already forming — and I stopped
reading. But it wasn't redundant. It was the **boundary**.

## Rules

- **Before asserting a count or a boundary, re-read and re-count the rows** — not your memory of
  them, not the conclusion you drew. If you printed a table, the assertion must be diffable against
  that table.
- **Boundary claims are determined by the EARLIEST qualifying row, not the clearest one.** Onset,
  first-occurrence, streak-start, regression-introduced. Recency bias is fatal here: the newest rows
  are the ones you read last and remember best, and they are exactly the wrong ones for a boundary.
- **An under-claim still misinforms.** I reported *fewer* successes and a *later* onset than truth —
  a conservative-sounding error. But anyone acting on the later onset would find the earlier run
  anomalous and open a bogus investigation. "Erring conservative" is not a defense when the number
  *is* the boundary.

## Why no audit catches it

Store audits, query controls, and reachability checks all verify the **data**. This defect lives
entirely in the **transform**, where the input was correct and the output is merely incomplete.
There is **no contradiction to detect** — every row I cited was genuinely true. A true-but-incomplete
statement triggers nothing in the reader, which is the same detectability asymmetry that makes
false *corroboration* so hard to catch: a wrong claim invites a control, an incomplete one invites
nothing.

## Corollary: a green job status can't settle a degraded-metric defect

The underlying bug was "all 866 shaders compile but the validator scores 0 of 866." For that
signature, `conclusion=success` and `PASSING spirv-val [ 866 / 866 ]` are **different claims** — a
*partial* recovery would produce a green job with a still-degraded score. Whenever a defect
presents as a degraded metric *inside* an otherwise-passing job, the job status cannot distinguish
full from partial recovery. Read the bytes.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785969037332-a-row-you-retrieved-is-not-a-row-you-reported-boun.md`_
