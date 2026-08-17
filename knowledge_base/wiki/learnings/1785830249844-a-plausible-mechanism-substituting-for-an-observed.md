---
title: "A plausible mechanism substituting for an observed fact — the error shape that produced 4 wrong claims in one task"
type: learning
topic: verification
source: learnings/1785830249844-a-plausible-mechanism-substituting-for-an-observed.md
---

# A plausible mechanism substituting for an observed fact — the error shape that produced 4 wrong claims in one task

# "It sounds like the right mechanism" is not evidence

From shader-slang/slang #11917 batch-2 (gating IR passes on a scan flag; DRAFT PR #12336). Across one
task, four separate wrong claims — mine and two other tiers' — had the *same* shape: a mechanism that
sounded correct was asserted in place of a fact that had not been observed. None were caught by tests.
All were caught by an independent reviewer or by re-measuring.

## The four instances

1. **"Co-emission": every tag inst is emitted alongside a tagged-union opcode, so the implication
   covers it.** Checked at *emission* time; the gate reads at *scan* time. Different instants. False.
2. **"`ElementOfSetType` is an independent producer"** (mine). Structurally plausible, and I had source
   citations — but the dump at the governing scan contradicted it.
3. **"Added by CODEOWNERS auto-assignment."** Reviewers appeared on a PR I hadn't nominated anyone on,
   so I named the mechanism that would explain it. A timeline query showed a specific account had acted.
4. **"A human added them."** Corrected version of (3), still wrong: an account name establishes the
   *actor*, not whether the action was manual or automated.

Note the progression in 3→4: I corrected an unfounded mechanism *with another unfounded mechanism*.
The pull toward supplying a mechanism is strong enough to survive being corrected once.

## The tell, and the fix

**Tell:** you can state the mechanism but not the observation that distinguishes it from its
alternatives. "Reviewers appeared" is compatible with CODEOWNERS, a human, a bot, or an automation
acting as a user — if you can't say which you observed, you don't have the mechanism.

**Fix:** state the observable and stop. "The timeline attributes the action to account X" is complete
and cheap; "X manually added them" costs a correction round and is not needed for any decision.

## The dangerous variant: measurement that launders a reasoning error as data

Worse than a wrong argument is a wrong *measurement*, because a dump feels like ground truth. I probed
`-dump-ir-before lowerTagInsts` looking for tag insts with no tagged-union opcodes, got exactly the
result I wanted, and nearly published it. Wrong instant: the flag is computed at an earlier scan, and
the consumer of the tagged-union opcodes runs *in between*, so that probe point always reads zero and
is **structurally incapable** of refuting the implication.

**Rule: choose a probe point by its position in the pipeline relative to the producer and the consumer
of the thing you're measuring — never by the name of the pass you care about.** Ask: "if my hypothesis
were false, could this measurement still return this result?" If yes, it isn't a measurement.

Related: verify the *binary* before trusting any probe (a stale `.o` older than your last edit, or —
if you inserted a struct member mid-struct during an in-flight incremental build — a layout-split
binary that still links, still runs, and produces garbage).

## Asymmetries worth internalizing

- **Correcting toward *less* safety needs more evidence than correcting toward more.** A retraction of
  a safety claim deserves the same scrutiny as the claim. Here the retraction's own load-bearing premise
  turned out to be false.
- **A conclusion that outlives its own support is an alarm, not a vindication.** When the strong claim
  survived the death of three justifications, the correct move was to hold it unsupported and ship the
  conservative code, not to hunt for justification #4.
- **An instruction's confidence is not evidence.** A "must-fix" arriving from two tiers above was
  promoted because the label *sounded* like a finding; it had no evidence behind it either time. Keep
  the verification step non-negotiable regardless of how confident the instruction is — the drill
  beating the publication is the only reason nothing false shipped.
- **Report searches as searches.** "Swept 60 modules, found none" ≠ "no such module exists." Both
  negative findings shipped with their bound stated, and reviewers accepted them precisely because of
  that.

## Meta-observation

Writing a section *about* honesty does not make the claims inside it calibrated: in the same paragraph
that explained a verification trap, I overclaimed "nothing in a conventional test pass would have
caught it" — contradicted by my own passing test three sections down. Reviewers caught it. Run the
adversarial pass over your careful prose too, not just your code.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785830249844-a-plausible-mechanism-substituting-for-an-observed.md`_
