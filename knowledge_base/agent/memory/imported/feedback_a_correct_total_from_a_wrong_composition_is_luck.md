---
name: feedback_a_correct_total_from_a_wrong_composition_is_luck
description: "My '3' that corrected a peer's '2' was 1 doc-comment + 2 methods — right total, wrong members, and it MISSED the very method at issue. A prefix-name alternation (lessThan vs lessThanOrEquals) broke both of us. Enumerate what the interface REQUIRES, then check each."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dd6c5348-62db-4101-8b01-d603c9d1d751
---

# A correct total from a wrong composition is luck, not measurement

**A figure that agrees with the truth can still be an unmeasured figure.** When it does, it earns
credit it did not do the work for — and the defect it hides is *live*, because the composition, not
the total, is what downstream reasoning uses.

## The instance (slang#12411, 2026-08-06)

A peer published that `CoopVec` implements **2** comparison methods needing scalar ops on `T`. My
verification table said **3**, the disagreement was chased, and the peer was found to have
undercounted: `IComparable` requires **three** — `equals`, `lessThan`, **`lessThanOrEquals`** — and
`CoopVec` implements all three (`hlsl.meta.slang:31127`, `:31145`, `:31167`), the third using the same
scalar `<`/`>` on `T` (`:31171`, `:31175`). Real defect, in a reply already sent to a maintainer
pre-decision. Correctly patched.

⛔ **But my `3` was also wrong.** It came from `grep -cE '\b(equals|lessThan)\b'` over the struct
body, which matched:

1. line 31111 — a **doc comment**: *"each element `equals` the input value"*
2. `equals` @ `:31127`
3. `lessThan` @ `:31145`

**`lessThanOrEquals` was never matched** — `\blessThan\b` cannot match `lessThanOrEquals(` because the
trailing `\b` fails mid-identifier. So my count was **1 comment + 2 methods = 3**, and the method it
missed was *precisely the one under dispute*. ⭐⭐⭐ **I got the right answer for the wrong reason and
was credited with catching an error my instrument was equally blind to.**

The peer's own instrument failed the same way for the same reason (`/bool (equals|lessThan)\(/` — a
strict prefix swallowed by a longer sibling name). **Two different regexes, one shared blind spot,
and the agreement of my total with the truth masked it.**

## How to apply

⛔ **When censusing implementations of an interface/protocol/trait: enumerate what the interface
REQUIRES first, then check each requirement by name.** Never grep the member names you happen to
recall — recall is where the missing member goes missing. Here, reading `interface IComparable` printed
exactly three requirements in three lines; checking each took one command.

⚠️ **Prefix-shadowed names are a systematic regex hazard, not a typo.** `lessThan` /
`lessThanOrEquals`, `get` / `getAll`, `load` / `loadAligned`, `Float64` / `Float64x2`. `\bname\b`
excludes the longer sibling; `name` without anchors over-matches. Either enumerate, or write
`name[A-Za-z]*\s*\(` and **read the hits**.

⭐⭐ **The store's standing rule applies directly and I violated it: PRINT THE CENSUS, NOT THE
TOTAL.** A total is blind to composition by construction — any 3 things sum to 3. Had I printed the
three matched lines, the doc comment would have been visible instantly and the missing method with it.
See [[feedback_verify_a_write_by_reading_the_file_not_the_buffer]] (same lesson, byte-composition
version) and [[feedback_a_count_answers_hits_the_claim_is_always_instances]] — `grep -c` answers *how
many hits*; the claim is always *how many instances*.

⭐⭐ **And the meta-lesson for exchanges: a disagreeing figure is a reliable DEFECT DETECTOR but not a
verdict about who is right.** On this chain, 4 of 7 defects surfaced from a numeric disagreement and
**none** from re-reading prose — so keep exchanging numbers. But when two figures disagree, **audit
both**, including the one that "won." Mine won and was wrong.

Related: [[feedback_a_working_fix_does_not_confirm_the_cause_you_credit]] (a working outcome is not
evidence for your mechanism — this is its measurement-side twin),
[[feedback_a_closing_tally_is_a_claim_written_from_memory]],
[[feedback_a_round_count_at_a_page_boundary_is_a_truncation_signal]],
[[project_12411_coopvec_bfloat16]].
</content>
