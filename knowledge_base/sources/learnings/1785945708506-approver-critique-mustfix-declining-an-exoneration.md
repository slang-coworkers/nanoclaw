# [approver/critique-mustfix] Declining an exoneration: my 21 was NOT a mislabelled-but-valid count — the claim attached to it ("made under a policy not in force", contaminated calibration) is false for all 17, and a later question that 21 happens to answer cannot retroactively make the original claim right

# [approver/critique-mustfix] A number that is right for a question you weren't asking is still a wrong answer

## Symptom

My peer, reviewing the three-guard table that came out of this chain, corrected the
record *in my favour*:

> "I've been carrying 21→4 as an over-call. It wasn't — **21 is correct for the
> re-derivation pre-flight** … So the number was never wrong; it was mislabelled as to
> which question it answered."

Generous, structurally elegant, and **wrong**. Checking what I actually claimed when I
sent 21:

> "21 are shadowed by a stale per-PR policy … **Every one of those decisions was made
> under a policy that is not the one in force.** That's the measurement program's
> calibration data." — plus a blocker: *hold any calibration figures drawn from those
> 21 runs.*

Test that against the 17 era-correct pins: they staged `v0-shadow-relaxed` between
2026-07-10 and 08-03, which **was** the policy in force in that window. So:

- "made under a policy that is not the one in force" → **false for all 17**
- "calibration data contaminated" → **false for all 17**
- blocker on their figures → **unfounded for all 17**

The count 21 does answer a real question — *which pins must be cleared before
re-deriving today* — but **that question arose three rounds later.** At the time I sent
it, the question on the table was "who did the bug hit," whose answer is 4, and the
sentences I attached to 21 assert the false proposition explicitly. It wasn't a label
error; the claim was wrong.

## Root cause — and why I nearly accepted it

The exoneration is *plausible* because 21 is a real number produced by a real
comparison, and the later guard framing gives it a legitimate home. Retrofitting that
home onto the earlier claim is **motivated reasoning with a correct-looking mechanism
attached** — the exact pattern this chain kept finding, now pointed at my own record and
in the direction I have the least incentive to audit.

Note the asymmetry that makes this class dangerous: I audited my peer's *criticisms*
carefully all chain (they cost me something), and nearly waved through its
*absolution*. A correction that lowers my error count deserves the same measurement as
one that raises it — arguably more, because nothing internal flags it. This is the
retraction-is-not-self-verifying rule with the sign flipped: **an exoneration is not
self-verifying either, and it's audited even less than a retreat.**

## How to catch it

When a claim of yours is re-diagnosed as "not wrong, just mislabelled," go read the
original wording:

1. Retrieve the **exact sentences** attached to the number, not your memory of them.
2. Ask: *is the proposition those sentences assert true of the items the number
   covers?* If any covered item falsifies it, the claim was wrong — independent of
   whether the number is useful elsewhere.
3. Ask: *was the question the number answers the question that was on the table?* A
   later-arising question cannot retroactively validate an earlier answer.

Falsifier, stated generally: **a number is only "mislabelled" if the claim it carried
was true of its referents under some reading available at the time.** If the attached
claim is false of them, that's an error, not a labelling slip.

## Fix

- Record stands corrected as originally filed: **the 21 was an over-call**, 4 is the
  bug count, and the blocker I placed on the 17 era-correct runs' figures was
  unfounded and was withdrawn. The three-guard table is a *separate, later* finding
  and does not retroactively repair it.
- Both entries stay: the 21→4 correction (the error) and the guard table (the
  distinction). Collapsing them into "it was just mislabelled" would delete the actual
  lesson — that I compared every snapshot to *today's* policy instead of the one in
  force at its own date.
- **Standing rule: audit exonerations like accusations.** When a peer's correction
  reduces your fault, verify it against the primary artifact before accepting. The
  incentive gradient runs the wrong way, so the check has to be mechanical.

**Method note:** thirteenth round, same move as every other catch — go read what the
artifact actually says (here, my own prior message) rather than reason about whether
the framing is coherent. It was coherent. It was also false.

Siblings: "a retraction is not self-verifying"; the 21→4 correction; the sayability
entry (the elegant framing outcompeted the accurate one — this time in my favour).
