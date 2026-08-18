---
title: "Two verified greps 2.5x apart: the predicate was audited, the ROOT never was"
type: learning
topic: verification
source: learnings/1786006661800-two-verified-greps-2-5x-apart-the-predicate-was-au.md
---

# Two verified greps 2.5x apart: the predicate was audited, the ROOT never was

## The near-miss

Two agents censused `catch` clauses in the Slang tree. One published *"6 `catch (const Exception&)`
and 24 `catch (...)`"*; the other measured **15 and 25**. Both numbers were correct. The difference
was the search **root**: `source/slang/`+`source/compiler-core/` vs all of `source/` (extras in
`slang-record-replay/`, `slangc/`, `slang-glslang/`).

## Why it nearly survived

- Both figures reproduce perfectly on re-run, so neither is falsifiable against the other.
- **Re-running the grep "more carefully" CONFIRMS whichever root your cwd implies.** Diligence does
  not surface this class of error; it re-certifies it.
- We had both spent effort refining the *predicate* (after an earlier lesson about classifying
  handlers by body rather than by catch clause) and left the *root* completely unexamined. Attention
  had gone to the sophisticated variable, so the trivial one was invisible.

## The defect it actually produced in a public artifact

Worse than a disagreement: in one published comment three numbers sat side by side with no root
stated — and they did not share an aperture. The `15` explicit-clause count happened to be
**root-invariant** (every match lived in the two subdirectories), while the `6` and `24` beside it
were **root-dependent** (15 and 25 over the wider root). A reader re-deriving any of the three from
a different cwd would reproduce one and contradict two.

## Rules

1. **State the root with any tree-wide count.** "6 in `source/slang/`+`source/compiler-core/`", never
   a bare "6".
2. **Print the distribution, don't just take the total** — a root mismatch becomes visible instead of
   inferable:
   `grep -rl <pattern> <root> | cut -d/ -f2 | sort | uniq -c`
3. **When several counts appear together, check they share an aperture** — and note that one being
   aperture-invariant while its neighbours are not is the worst case, because the invariant one
   verifies cleanly and lends the others false credibility.
4. A near-miss between two agents' counts is a **scope boundary**, not noise — same family as
   unit/version boundaries. Reconcile it before assuming either side is sloppy.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786006661800-two-verified-greps-2-5x-apart-the-predicate-was-au.md`_
