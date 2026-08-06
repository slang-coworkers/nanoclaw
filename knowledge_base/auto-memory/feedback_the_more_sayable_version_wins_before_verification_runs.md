---
name: feedback_the_more_sayable_version_wins_before_verification_runs
description: "A crisp false mechanism outcompetes a dull true one, and an inflated magnitude outcompetes an accurate one — the selection happens during DRAFTING, upstream of any verification step. 4 measured instances across 2 actors in one chain (slangpy#925)."
metadata:
  node_type: memory
  type: feedback
  originSessionId: webhook-slangpy-925-2026-08-05
---

# The more sayable version wins — and it wins before verification runs

⛔**Given a true-but-structural explanation and a false-but-crisp one, the crisp
one reaches the reader.** Not because it survives scrutiny — **because the
selection happens in DRAFTING, upstream of the step that would have caught it.**
Verification never fires, since by the time you're checking, the sayable version
is already the claim you're checking.

## The measurement that earns this — 4 instances, 2 actors, one chain

**slangpy#925, 2026-08-05.** Every time, a **real** finding got a **false**
mechanism welded to it, and the mechanism was the crisp half:

| real (dull, structural) | false (crisp, shipped) |
|---|---|
| finding buried two `<details>` deep, outside diff range | "**already public via CodeRabbit**" |
| clause short-circuited at the `:184` policy-waiver branch | "**blind surface** — read the wrong API" |
| no TTL on parked rows: 0 hits in 712 lines of sweep | "**delivery asymmetry** — success events may never fire" |
| 4 stale pins, 17 era-correct, shared fallback root cause | "**21 of 57 decisions under an unsigned policy**" |

⭐⭐⭐**And the last row shows the failure is not limited to mechanisms — it selects
for INFLATED MAGNITUDE too.** "21 of 57 under an unsigned policy" is alarming and
one line; "4, and 17 were correct pinning, and the 4 share a fallback cause" is
dull and three clauses. **The inflated figure went upstream first**, and an
inflated blast radius drives worse remediation than the true one (it invites
reverting a deliberate, human-signed policy rather than fixing a staging
fallback).

⚠️**Both actors did it, in both directions** — so this is not one agent's stylistic
tic. The approver produced 3 of the crisp-false halves; I forwarded or produced the
others. **Peer review did not filter it**, because the crisp version is also the
easier one to *agree* with.

## Why the usual defences don't catch it

- **It is not a lie or a guess.** Each false mechanism was *plausible* and
  *adjacent to a verified fact*, which is why it read as pre-checked. See
  [[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]].
- **The conclusion is right**, so challenging it produces a defence of the
  mechanism rather than a re-derivation ⇒ ⭐⭐⭐**a correct conclusion reached
  through a wrong mechanism gets DEFENDED WITH THE WRONG EVIDENCE when
  challenged.**
- **A hold/retraction is not exempt.** Two of the four were recommendations to
  *not act*, which feel epistemically safe and so get audited less. ⭐⭐**A hold
  deserves the same audit as an arm.**

## How to apply

Before sending, on any claim that has a **mechanism** or a **magnitude**:

1. **Name the dull version.** If you can state a structural, boring alternative
   ("no TTL in 712 lines", "17 were era-correct"), ask which one you actually
   measured — and send that one, even though it reads worse.
2. **Separate the finding from its explanation** and label each: *measured* vs
   *inferred*. The finding usually survives; the mechanism usually doesn't.
3. **For any count, name the comparison that produced it.** The 21 came from
   comparing every snapshot to *today's* version; era-relative comparison gave 4.
   ⇒ **a magnitude without its comparator is not a measurement.** (Same root as
   the two-birthdays error: [[feedback_a_reviews_commit_id_can_postdate_the_review]].)
4. **Treat your own rising confidence across restatements as the trigger to go
   look** — repetition is not re-measurement.

### ⛔⭐⭐⭐ SIGN-FLIPPED: an EXONERATION gets audited least of all

**08-05, end of the same chain — and I authored this one.** I proposed that the
approver's `21→4` over-call *"was never wrong, only mislabelled as to which
question it answered"*, on the strength of a later three-guard table where 21 is
the correct re-derivation pre-flight. **Elegant, coherent, and false — it does not
survive reading what was actually written.** Its original sentence was:

> "21 are shadowed by a stale per-PR policy … **Every one of those decisions was
> made under a policy that is not the one in force.** That's the measurement
> program's calibration data."

For the **17 era-correct pins that proposition is false** — they staged
`v0-shadow-relaxed` between 07-10 and 08-03, when `v0-shadow-relaxed` *was* in
force. And the question 21 legitimately answers arose **three rounds later**.
⇒ ⭐⭐⭐**A LATER QUESTION CANNOT RETROACTIVELY VALIDATE AN EARLIER ANSWER.**

⭐⭐⭐**THE TEST (the approver's, and it's the sharpest instrument in this file): a
number is only "mislabelled" if the claim it CARRIED was true of its REFERENTS
under some reading available AT THE TIME.** Mine asserted contamination of runs
that weren't contaminated ⇒ **error, not labelling slip.** Collapsing the two
entries would have deleted the actual lesson (comparing every snapshot to *today's*
policy instead of the one in force at its own date).

⛔**Why this is the least-audited direction of all:** the approver audited every
criticism I sent closely — those cost it something — and **nearly waved through my
absolution.** ⇒ ⭐⭐⭐**A CORRECTION THAT LOWERS AN ERROR COUNT DESERVES MORE
SCRUTINY THAN ONE THAT RAISES IT, BECAUSE NOTHING INTERNAL FLAGS IT.** This is
[[feedback_a_guard_can_be_inert_and_read_as_passing]]'s retraction rule with the
sign flipped, and the flipped version is audited even less — a retraction at least
*feels* like a cost.

⚠️**My side of it: I GENERATED the exoneration**, and it read as insight/generosity
rather than as a claim under test. ⇒ **Mechanical check: go read the ORIGINAL
WORDING, not your memory of it, before crediting anyone (including yourself) with
having been right.** Note it is also the sayability failure once more — "the number
was never wrong" is crisper than "it asserted contamination of 17 uncontaminated
runs."

### ⛔ The stage-substitution corollary — the highest-cost form

⭐⭐⭐**WHEN CORRECTING A DEFECT AT STAGE N, REPORT THE CORRECTED *DERIVATION*,
NEVER THE CORRECTED *OUTCOME*, UNTIL STAGE N+1 HAS ACTUALLY RUN.** In an auditable
procedure the **reason** a decision was right is itself the deliverable, so
substituting a downstream stage is never harmless.

Measured: fixing a Step-1 clause defect on slangpy#925 got reported as
*"#925 was `WOULD_APPROVE`-eligible."* Clause-eligible only means **Step 2 runs**.
Step 2's actual input was `verdict: REQUEST_CHANGES`, 2 gaps ⇒ the real outcome is
**ABSTAIN_POLICY:OPEN_GAP or BLOCK**. Same verdict, sound derivation.

⚠️**Vocabulary fix, concrete: say "would have reached Step 2", NEVER "was
approvable."** The phrase `WOULD_APPROVE-eligible` **contains the verdict token**,
so readers extract the verdict — sayability operating at the level of a single
word.

⛔**Direction matters for cost: a false statement in the PERMISSIVE direction
about your own judgment is the most expensive kind you can emit** — worse than an
inflated alarm, which at least errs toward caution. Here it invited *"so the
approver would have approved a PR with a known one-line regression"*, the opposite
of true, and the class of claim that ends a shadow-mode programme.
⚠️**And the same bad inference was then multiplied across 3 more decisions**
(`1078`×2, `918`) from one clause state, with no Step-2 read on any of them.

⭐⭐⭐**The move that actually worked, 4 times out of 4: ask for a VALUE BY PATH,
not for a better argument.** "Don't take my file as authoritative — read yours and
print `protected_paths` with its absolute path" produced the policy finding;
"split the 232 by era" produced the 21→4 correction. **Neither was a
counter-argument.** A request for a value has no sayability advantage to exploit.
Third confirmed instance of the by-path move — see
[[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]].

## Evidence base

FOUR instances in one chain (slangpy#925, 08-05), spanning **two independent
actors** and both polarities (false mechanism ×3, inflated magnitude ×1). The
mechanism is **structural** — drafting selects before verification, so the filter
sits upstream of every check — and it is corroborated by the peer failing to
filter it in both directions. ⚠️Single chain, so the *frequency* is unestablished;
re-derive when it next fires.

Related: [[feedback_control_the_instrument_not_the_reasoning]] ·
[[feedback_a_negative_control_must_vary_exactly_one_thing]] ·
[[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] ·
[[project_slangpy_925_manylinux_2_28_version_override]]
