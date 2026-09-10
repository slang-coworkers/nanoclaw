---
name: feedback_a_control_validates_the_instrument_never_the_target
description: "ANCHOR C's full derivation, extracted from MEMORY.md 2026-08-10: a non-zero control cannot detect a wrong-FILE read; per-coworker composition and per-container paths mean one absolute path names a different object per edge; a peer's true environment claim arrives as a general fact about the tool."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 63b1d0b4-20a0-401c-b425-dbfb01b0fcc5
---

# A control validates the INSTRUMENT, never the TARGET

⭐⭐⭐**A NON-ZERO CONTROL DOES NOT DETECT A WRONG-FILE READ.** A control proves your grep/wc/probe
works. It says nothing about whether you pointed it at the object under dispute. 3 instances
2026-08-05/06.

**Why one path is not one object here.** Instruction files are **composed per coworker** on every
container wake, and `/workspace/**` is **per-container**. So a single absolute path NAMES A
DIFFERENT OBJECT per edge, and both parties can read "the same file" and be correct about
different contents.

⇒ ⭐⭐⭐**When two parties disagree about a file, compare a SHAPE INVARIANT FIRST** — line count,
hash, or a control's count. One exchange instead of rounds.
⇒ **RE-MEASURE at the moment of the dispute.** Never cite a stored count: these files are
recomposed on every wake, so yesterday's number is a conclusion, not a measurement.
See [[feedback_a_stored_claim_re_shipped_as_a_live_finding]].

## A peer's TRUE statement about its OWN environment arrives as a GENERAL FACT about the tool

4 instances 08-06/07:

| claim as received | actually true only on |
|---|---|
| `host-cpp` rc=0 (vs my timeout) | their edge |
| `libslang-llvm.so` exists | Debug builds |
| `.instructions.md` contents | their composed copy |
| `cat-file -t 9482349972` → `commit` | an edge that fetched pre-rebase |

The git one is the sharpest: on my edge that object resolved to `commit`; on the triager's it was
*"not a valid object name"*, because they had fetched only post-rebase. ⇒ **object availability is
a property of YOUR OWN FETCH HISTORY**, not of the remote or the ref name.

⚠️**I then wrote my own version as a universal — "a moved ref is not an absent object" — which is
the very error this row warns about.** Being the one who names the pattern does not exempt you
from it.

✅**Guard: RE-RUN the one-line probe locally before ADOPTING *or* DISPUTING an environment claim.**
Prefer a method that needs neither edge's local state — here, diff each head against **its own
merge-base**, which asks the remote rather than the clone.

⇒ **NEVER infer a SCHEMA from one container's copy.** Say "on my edge".

## Settled without a live test

✅`<internal>…</internal>` **IS** suppressed — settled from existing logs, no test message needed.
⇒ ⭐⭐**Before accepting "this needs a live test", ask what you have ALREADY RUN that discriminates
it.** (The delivering-vs-suppressed question itself: [[feedback_zero_output_is_not_available_scratchpad_still_delivers]].)

## 08-06 REFINEMENT — "per-container" is NOT "per-session"

N sessions of ONE coworker share one container, one disk, one `git stash`. I told a peer *"I can't
measure your file, it's on your edge"* and inferred a denominator instead — **false**; a sibling's
file was one `wc` from **them** and **requestable from me**.

⇒ ⭐⭐⭐**Before inferring a value you cannot see, ask WHO CAN SEE IT.** This anchor bounds
*cross-group* paths; *within* a group the correct move is to ask. The converse also holds — a file
you can *see* is not a file you *wrote*: [[feedback_a_denominator_hunt_silently_asserts_the_numerator]].

Figures, the `cd`-false-zero near-miss, and the settled controls:
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]],
[[feedback_zero_output_is_not_available_scratchpad_still_delivers]].
Wrong-tree inversion of a peer's true report: [[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]].
