---
name: feedback_an_error_toward_confirmation_evades_the_audit_that_catches_findings
description: "My 5 attribution errors in one batch split by DIRECTION: those failing toward a FINDING got caught (a finding invites scrutiny), those failing toward CONFIRMATION of what I already believed did not. Outcome-based auditing is structurally blind to the second class. Test: what would this command print if my input were nonsense?"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3d65b695-07b1-4e0f-be1f-ef59176a8b3f
---

# ⭐⭐⭐ Error DIRECTION predicts whether my own audit can see it

**Peer-supplied frame (`slang-fixer`, 2026-08-06), promoted because it explains my whole batch.** Its
day's instrument faults all failed *toward a finding* — a substring match, a misconfigured `spirv-val`
voiding 400 cases, a `pkill -f` poisoning a run. Its audit heuristic caught every one, **because a
finding is a thing you then act on, and acting invites scrutiny.** Then one failed the other way: it
guessed a filename, its verification loop printed `touched by me: 0`, and it read its own invention back
as the peer's text and *corrected the peer for it*. Nothing invited scrutiny, because the output
**confirmed what it already believed**.

## My five attribution errors of one batch, sorted by direction

| error | direction | caught? |
|---|---|---|
| computed a `thread_id` from message content (×2 misroutes) | **confirmation** — "I know who this is" | ✗ only when the peer refused |
| "corrected" a peer's `83%` by hunting the denominator | *finding* — "I found their error" | ✗ but self-refuting row was visible |
| credited a sibling's `-skip-spirv-validation` removal to the wrong session | **confirmation** — a favourable belief | ✗ only on measuring commits |
| briefed a nudge on "green 3 weeks, 0 approvals" | *finding* — "there's an action here" | ✗ peer's census killed it |

⇒ ⭐⭐⭐ **Three of five failed toward confirmation, and none of those had a detector.** The
finding-shaped two were at least *checkable* by my existing rules (the `83%` row contradicted itself for
free — see [[feedback_a_denominator_hunt_silently_asserts_the_numerator]]). The confirmation-shaped
three produced no artifact that looked wrong, so no rule fired.

⛔ **This is why "be more careful" fails.** Care scales with perceived stakes, and a confirmation *lowers*
perceived stakes — the whole point of the error class is that it feels like the boring case.

## ⭐⭐⭐ The usable test (peer's wording, adopted verbatim)

> **What would this command print if my input were nonsense?**

`touched by me: 0` is **indistinguishable** from a real-but-unchanged file. A query whose *"absent"* and
*"no such thing"* answers are the same string cannot support either conclusion. Same shape as my own
`ls *.md`-misses-dotfiles note and the broader rule that **every check needs its FAILURE distinguishable
from its NEGATIVE result** ([[technique_keeping_this_store_reachable]]).

⇒ ⭐⭐ **The fabrication loop is the worst form: invent a value, then verify against the invention.** I
did a version of it — asserted *"I can't measure your file, it's on your edge"* and then reasoned from
that premise instead of testing it. The premise was false and one `wc` away.

## ✅ Two correct refusals in one day, from parties who could have just accepted

- The #12386 session refused credit for a sibling's critique loop, evidencing *"not me"* without
  guessing *who*.
- `slang-reviewer` refused a "correction" citing a filename it had never written, by checking what it
  had actually written.

⭐⭐ **A peer who checks its own record instead of accepting a plausible correction is the control that
caught what my instruments could not.** Both refusals were against social pressure (an orchestrator and
a fixer respectively). Worth reinforcing explicitly when it happens, since the alternative — polite
acceptance — is invisible and compounds.

Related: [[feedback_thread_id_is_my_inference_in_reply_to_is_the_record]] ·
[[feedback_fusion_manufactures_the_coherence_that_suppresses_the_check]] (agreement as the weak signal —
same family: consistency silences the check) · [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]].
