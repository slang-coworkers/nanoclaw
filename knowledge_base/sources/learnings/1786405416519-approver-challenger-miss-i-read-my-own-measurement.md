---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786387700481-wz3abm
written_at: 2026-08-10T23:43:36.519Z
---

# [approver/challenger-miss] I read my own measurement table backwards and called it "mechanism observed end-to-end" — and my first detector could not fail

## Symptom

Reviewing slang#12452 (public-header constants `inline constexpr` →
`static constexpr` to fix a mixed-ASan ODR violation), I measured symbol bindings
and wrote:

> "the instrumented copy is a `WEAK` cross-module symbol **whose recorded size
> grows by the redzone** … the stated mechanism is real and the fix addresses it at
> the right layer."

My own table, three lines above that sentence, said:

| address-ODR-used, clang + ASan | BEFORE `inline constexpr` | AFTER `static constexpr` |
|---|---|---|
| | `WEAK`, **size 4** | `LOCAL`, **size 32** |

The 32 is on the symbol the fix **creates**. The pre-fix "offender" is size 4 —
it did not grow. I had the refuting data in my own artifact, quoted it as support,
and propagated "mechanism is real" into the decision and both deliverables. An
OUTPUT_REVIEW critique caught it.

Re-measured properly (4→4 for `inline constexpr`, 4→32 for `static constexpr`):
on that toolchain the claimed offender is **not size-redzoned**, so the reported
cross-module size mismatch does not arise there at all.

## Root cause 1 — a number I measured myself is still a claim I have to read

Confirmation bias is usually framed as being credulous about *other people's*
claims. This was the opposite: the measurement was correct and my **sentence about
it** inverted the direction. Nothing in "I ran the command myself" protects the
prose that follows.

⭐ **After writing a conclusion from a table, re-read the table against the
sentence, column by column.** Which column is BEFORE? Which value moved? Does the
direction of movement match the story I just told?

Note the error direction: it made the PR look verified *and* my review look
thorough ("mechanism observed end-to-end" is the strongest possible phrasing).
Every self-reversal in that session moved from more confident to less — never once
the reverse. A conclusion that flatters both the subject and the reviewer deserves
the re-read first.

## Root cause 2 — my first detector could not fail

Before the size test, I checked whether ASan registered the globals by counting
`asan_globals` ELF sections. Both spellings returned **0**, which I was about to
read as "not instrumented".

Then I ran a positive control — a plainly instrumentable `int gArr[16]` — and it
**also** showed 0 `asan_globals` sections, while its size grew 64→96 under
`-fsanitize=address`. So the detector returned 0 for a known-true case: its zeros
carried no information whatsoever, and the metadata simply is not in the section
name I was counting.

⭐⭐ **Every detector needs a known-positive input before its negative is
admissible.** The size-delta signal only became usable *because* the control
proved it fires. Two extra lines converted an inert probe into a real one — and
without them I would have shipped a second wrong mechanism claim to replace the
first.

This is the same shape as "a negative branch reached by fall-through is the least
trustworthy result a check can produce": nothing had to work for `0` to be
printed.

## How to catch both

1. **Validate the instrument, then measure.** For any "does the compiler/runtime do
   X?" question: construct a case where X is certainly true, confirm the probe
   fires, and only then trust the probe's negative.
2. **Diff the prose against the data.** Re-read each numeric claim by pointing at
   the cell it came from. If you cannot name the row and column, you are quoting
   memory, not measurement.
3. **Do not let a corrected claim's replacement go unvalidated.** I twice replaced
   a wrong mechanism claim with another unverified one (first "not a redzone,
   generic padding" — also wrong; the growth *is* an ASan redzone, just on a
   harmless `LOCAL` symbol). A retraction is not a license to assert the opposite
   without evidence.
4. **Say "not verified" rather than picking a direction.** The honest end state was:
   the linkage transition is measured, the vendor's stated ASan mechanism is not
   reproduced here, and that is not evidence the PR is wrong (the upstream report
   is real and its platform is unnamed).
