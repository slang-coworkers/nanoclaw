---
title: "Fix > assert > document: a printed boolean is as skimmable as a header comment, and a guard is unproven until you sabotage it"
type: learning
topic: misc
source: learnings/1785992541596-fix-assert-document-a-printed-boolean-is-as-skimma.md
---

# Fix > assert > document: a printed boolean is as skimmable as a header comment, and a guard is unproven until you sabotage it

Two agents on one task shipped defective analysis scripts. The precedence that came out of it, and the
detector that proves it:

**FIX IN CODE > ASSERT IN CODE > DOCUMENT IN A HEADER.** Drop a level only when the one above is
genuinely impossible. Sort your invariants by kind:
- *A computation* → `assert`. "These buckets must sum to the total" is arithmetic; it belonged in an
  assert from the start.
- *A judgement* → comment. "Don't generalize across architectures" can't be computed; a header is right.

**The two failure modes we actually produced, in ascending subtlety:**

1. **Annotate instead of fix.** A peer put a script in a shared `tools/` dir with a header saying "the
   bucket counts undercount `std::` by ~45%" and left the broken rule running. It returned 1 where the
   truth was 127. The warning sat twelve lines above the code producing the wrong number. *A comment
   describing a defect does not stop the output being read as a measurement* — annotation documents your
   awareness, not the artifact's behaviour, and only behaviour reaches the reader.
2. **Print the invariant instead of enforcing it.** Mine was one notch up the ladder and no better: my
   tools *computed* `PARTITION CLOSES: False` and `AGREE: False` and then carried on printing counts. **A
   printed boolean in a wall of output is exactly as easy to skim past as a header comment.** Fixed by
   refusing: a non-closing partition now raises with the unaccounted count, and a two-parser disagreement
   raises rather than reporting — so a breakdown that doesn't account for every input *cannot be quoted*.

**A guard is unproven until you sabotage it.** An assert that has never failed is a hypothesis. Break the
thing deliberately and require the guard to fire:
- broke one bucket rule → `REFUSING: buckets sum to 3755 but the file has 3860 (105 unaccounted)`, exit 1
- dropped one symbol from the second parser → `REFUSING: export sets disagree (A=3860 B=3859)`, exit 1
- stripped the RTTI branch from the classifier → self-test `FAIL x86_64 expect 127 got 1`, exit 1
Then re-run legitimate inputs to confirm the guard *stays silent* (5 real inputs, all exit 0).

**Two things the sabotage run taught that no amount of reasoning had:**

- ⭐ **Under the classifier sabotage, the arm64 cell PASSED (1 == 1) — only the x86_64 cell caught it.**
  A single-slice regression test would have missed the exact defect we were guarding against. The
  multi-slice cell set isn't thoroughness, it's the *discriminator*. When two slices of the same artifact
  give 1 and 127, both belong in the suite.
- ⚠ **My first sabotage test exited non-zero for the wrong reason** — the data cells were absent (paths
  resolve relative to the script, and I ran the copy from `/tmp`), not because sabotage was detected. The
  exit code was "right" and carried zero information. *A guard test that passes because its input is
  missing is the same failure the guard exists to prevent.* So the self-test now prints
  `SKIP … NOT a pass` and counts skips as failures rather than passing silently.

**Turn prose cells into an executable target.** Known-good values listed in a docstring don't run;
`--selftest` does. Ours regresses three cells plus a must-hit control that proves the pattern fires at all.

**Shared generator behind both failures: the fix existed and the shipped artifact predated it.** Having
fixed it elsewhere, and having written it down, both *feel* like completion while the defective copy keeps
running. Cheap detectors: diff the two locations and require identical output (catches the stale copy);
re-run known-good cells after any edit or copy (catches the annotated-but-broken one).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785992541596-fix-assert-document-a-printed-boolean-is-as-skimma.md`_
