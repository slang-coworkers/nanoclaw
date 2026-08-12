# A fidelity gate firing on a corrupted reference produces a demand that looks exactly like diligence

# When a reviewer demands a change to text you believe is faithful, diff against the original first

From shader-slang/slang #11917 batch-2 (PR #12336). An operator gave a requirement marked **verbatim**.
I transcribed it into an independent reviewer's prompt and, summarizing, re-rendered their bold lowercase
`because` as uppercase `BECAUSE` for emphasis. The reviewer then returned **must-fix: restore the
capitalization to satisfy the explicit verbatim requirement** — correctly enforcing verbatim against the
text *it had been given*, which was already corrupted by me.

Complying would have made the published artifact **less** faithful to the source instruction, while
looking precisely like compliance.

## Why this failure mode is dangerous

- The demand is **locally correct** (the artifact really does differ from the supplied reference) and
  **globally wrong** (the reference, not the artifact, is the corrupted one).
- The resulting action is **indistinguishable from diligence** — you'd be following a review finding,
  citing a stated requirement, producing a diff. Nothing looks off.
- Ordinary review discipline pushes *toward* the error: the reviewer is independent, the finding is
  specific, and arguing with it feels like resisting oversight.

## The two-sided remedy

**As the one being reviewed:** a fidelity complaint is a claim about **two** artifacts — the deliverable
*and* the reference. Check both before complying. Decline with the source quoted if the reference is the
thing that's wrong; that is the only move that catches this.

**As the one delegating:** when a requirement is verbatim, hand over the **source quote, fenced or
quoted**, never a retyped rendering. Prose carrying emphasis markup (bold, italics, caps-for-emphasis) does
not survive transcription — and if the spec has to be paraphrased to reach the reviewer, **your paraphrase
becomes the de-facto spec.**

## Same shape as the other instrument failures in that task

Every error in this batch was an instrument returning a well-formed answer to a slightly different
question than the one asked:

- `slang-test` reporting `100% of tests passed (264/264)` computed over survivors after discarding 265
  failures;
- `grep -c` counting matching **lines**, not occurrences (turning ~42 sites into "16");
- a probe grepping `BEFORE <pass>` when only the *after* hook was installed — a whole control matrix of
  zeros;
- a reviewer count **sampled from a still-growing stream** and published as a total;
- and finally a **paraphrased instruction** enforced as a spec.

⇒ In each case the tool worked; the reference was wrong. **The defence is not care, it is a comparison
that generates its own baseline.** A two-sided drill (neuter → run → restore → run) never needed to know
the correct absolute total, only that the two arms differed — which is why it survived every one of these
defects while the single-reading checks did not.

## Corollary on where to put a bound

Related position rule from the same review: scope a claim **at the sentence that makes it**, not in a
qualifier three paragraphs later. "On the exercised configurations a dead gate is caught by the suites"
beats an unqualified claim plus a distant gaps section — **a reader who stops at the sentence should get
the bounded version.** Restatements in headings, tables and summary lines outrank body prose, because
they are what gets read instead of it.
