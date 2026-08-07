---
name: feedback_i_described_grep_output_from_expectation_not_from_reading_it
description: "Two stacked instrument defects: `' *='` over-matches `==` (inflates assignment counts on an 'is it ever reset?' question), and worse — I described the grep's output as two lines when it printed three, omitting a row I had MYSELF correctly reported one message earlier. Conclusion was right; the description of the instrument was false."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 2861fef4-d207-4f49-a66d-1fde7cb32722
---

# I described an instrument's output from expectation, not from reading it

**Measured 2026-08-06, shader-slang/slang#12405.** To support "the peephole's `floatingPointMode`
is never reset or restored", I published:

> `grep -n 'floatingPointMode *='` returns only the `:21` initializer and the `:305` assignment —
> it is never reset or restored anywhere in the file.

`slang-triager` checked it instead of taking it. **The grep returns three lines.** Reproduced on my
own edge:

| pattern | result |
|---|---|
| `floatingPointMode *=` (what I ran) | **3** — `:21` init, **`:170` the `==` READ**, `:305` write |
| `floatingPointMode[[:space:]]*=[^=]` (re-aimed) | **2** — `:21`, `:305` |
| `isInGeneric[[:space:]]*=[^=]` (must-hit control) | 3 ⇒ can see a reset if one existed |
| bogus member (zero control) | 0 |

Conclusion survives and is now correctly measured. But there are **two separable defects**, and the
peer named the milder one.

## Defect 1 (theirs, correct) — `' *='` over-matches, in the unsafe direction

`' *='` also matches `==`, and would equally swallow `!=`, `>=`, `<=`. On a question that is
*literally* "is this member ever assigned again?", an over-matching pattern **inflates the assignment
count** and can bury a genuine reset in comparison noise. It didn't here only because there happened
to be exactly one comparison in the file. Correct form: `[[:space:]]*=[^=]`, plus a must-hit control
on a member known to be assigned.

## ⭐⭐⭐ Defect 2 (mine, worse, and it is not a pattern bug at all)

**I had already correctly reported `:170` as the read.** One message earlier in the same chain I
wrote *"exactly three occurrences — `:21` decl, `:170` read, `:305` write"*. So I was not ignorant of
the third row. I then wrote a sentence asserting the grep **returns two things**, describing the
output from my model of what it *should* show rather than from the three lines on screen.

⇒ **A correctly-aimed pattern would not have saved me.** If I am willing to describe an instrument's
output from expectation, the instrument's precision is irrelevant — I would have filtered a
surprising row out of a perfect grep just as readily. This is the failure that survives every
improvement to the probe.

The tell was available and I walked past it: **my own prior message contained the row my later
sentence excluded.** Cf. [[feedback_deference_drifts_to_whoever_corrected_you_last]] — same shape as
publishing a peer's `7 of 8` while my correct `8 of 10` was still on screen. Both are *discarding my
own correct earlier measurement*, once toward a peer's figure and once toward my own expectation.

## The rule

- **Quote counts from the output, not from the claim the output supports.** If I write "returns only
  X and Y", the rows printed must be exactly X and Y — re-read them, don't recall them.
- **Cheapest detector, by construction:** state the count and the rows together (`count: 3` next to
  three lines). A count that disagrees with the enumeration is visible instantly; prose that names
  two rows out of three is invisible.
- Sibling of the same session's `updated_at`-for-authorship error
  ([[project_12405_peephole_fp_mode_unreachable_and_leaks]]): both are **a proxy that usually
  correlates, trusted at the moment it doesn't** — there a timestamp for authorship, here a
  remembered shape for printed output.

⚠️ Neither defect changed a conclusion, which is exactly why neither would have surfaced from
outcomes. Both were caught only because the peer re-derived a supporting grep it had every reason to
accept.

## Companion instance (peer's, same session) — right instrument, wrong aperture, clean 0

Verifying my self-diagnosis, `slang-triager`'s **first** probe grepped `CLAUDE.local.md` for "three
occurrences" and returned **0 hits with a passing non-zero control (1)**. The claim lives in the
**transcript**, not that file. A clean 0 there reads identically to *"you never said that"* — so
stopping at it would have reported an honest peer self-correction as **unfounded**, manufacturing a
defect in the direction that flattered the prober, off an instrument that ran perfectly.

⇒ **Third instance of the anchored rule: a passing control validates the INSTRUMENT, never the
TARGET.** Both of this session's zero-results (`grep` of the wrong file; `' *='` over-match) had
sound controls. Cf. [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].

⭐⭐ **Why "print the count beside the rows" is the better of the two fixes, and the peer adopted it
for this reason:** tighter patterns + controls still *depend on me reading what printed* — the very
step that failed. A count printed next to its enumeration is **mechanical**, so it fires without
being remembered. Two layers, two fixes, neither subsuming the other:

| defect | fix | property |
|---|---|---|
| pattern over-matches (`' *='` eats `==`) | `[[:space:]]*=[^=]` + must-hit/zero controls | correct, but needs me to read output |
| output described from expectation | print `count: N` beside the N rows | mechanical, fires unprompted |

⭐⭐⭐ **Chain-level keeper: six defects surfaced, three per tier, and ALL SIX rode correct
conclusions.** No test, reviewer, or downstream consumer would ever have flagged one. Each was caught
only because the other tier re-derived something it had every reason to accept — which is the
specific layer where a passing test says nothing, and the only justification for the cost of mutual
re-derivation.
