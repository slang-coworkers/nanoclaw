---
name: feedback_reversing_a_correct_position_under_a_defective_input
description: "Corrections, authority and dispatch: when a defective input (bad measurement or procedural correction) pushes you off a CORRECT position — retract the DISPATCH, keep the POSITION · dispatch-conflict procedure: surface both verbatim, refuse to arbitrate, DEFER-UPWARD IS NOT SAFE · a correction carries borrowed credibility ⇒ quote, don't describe · over-hedging a verified claim is unsafe when a human's risk decision reads your confidence"
metadata: 
  node_type: memory
  type: feedback
  tags: 
    - corrections
    - authority
    - dispatch
    - review
  originSessionId: 68b2a50a-31d8-4902-bb23-826127e1e4a6
---

# Reversing a correct position under pressure from a defective input

**#11616/#11617, 2026-08-04.** The opposite of "a claim outran its evidence": two tiers abandoned a
**correct** state under a defective input, in one exchange.

| tier | defective input | abandoned |
|---|---|---|
| slang-fixer | a **bad measurement** (plain `[ForceInline]` shows no serialized restore scope ⇒ generalized to all inlining) | a correct architectural position |
| slang-triager | a **procedural correction** allowed to act as a technical one | the decisive merits argument |

The tell: **you can name what you gave up.**

## The rule

⭐⭐⭐ **PROCEDURAL DEFERENCE IS NOT A SUBSTITUTE FOR A MERITS JUDGMENT.** The triager held the decisive
argument (*pdeayton reserved the naming; you cannot ship an opcode without naming it*) and dropped it on
discovering it had broken a *process* rule (dispatching where I held the dispatch line).
⇒ **Retract the DISPATCH, keep the POSITION** — route the position through whoever holds dispatch.
Collapsing the two inverts the technical call.

⭐⭐⭐ **The correction you don't challenge is the one confirming you were wrong** — and one dressed as
*process* gets the least scrutiny. Check corrections in **both** directions: codex "corrected" the
fixer's self-correction (claimed empty-stdout pipes; both commands had `2>&1`) and had to withdraw.

## Dispatch-conflict procedure

Four instructions reached one coworker in minutes: mine *implement, don't wait* (**wrong**); triager's
*don't start* (correct); triager's withdrawal *follow parent* (**wrong**); my reversal (correct). **The
fixer refused to arbitrate both times — the only thing that stopped the rework.**

⛔⭐⭐⭐ **"DEFER UPWARD" IS NOT A SAFE DEFAULT — upward was wrong first.** The standing response is a
procedure, not a hierarchy:

> **Surface both instructions verbatim, refuse to arbitrate, name the cost asymmetry.**

⭐⭐ The rule survived because the **deepest** tier enforced it. ⇒ Tell downstream coworkers: *this
applies even when the conflicting instruction comes from me*, and *a later message from me supersedes an
earlier one only when it says so.*

## Corrections carry borrowed credibility

⭐⭐⭐ **A correction arrives with credibility borrowed from the act of correcting, independent of whether
it is right** (the fixer's rule). Strongest **down-tier**: the receiver has the least standing to check
and the most reason to assume it was verified. In #11617 the triager sent a wrong correction down **and I
endorsed it**; the fixer won by running one command (see
[[feedback_measure_a_pr_at_its_sha_not_the_ambient_checkout]]). ⇒ **a correction sent down-tier needs
the same control as a claim published up-tier.**

⛔⭐⭐⭐ **Worst flavour: a correction phrased as a CHARACTERIZATION of an artifact only the sender can
see** — unfalsifiable by construction (the receiver holds no copy). ⇒ **quote the sent text, don't
describe it.**

⭐⭐ **Credit arriving toward you is the least-audited direction.** The fixer credited the triager with a
framing that was mine; the triager caught it by **checking its own outbound**, not memory. ⇒ verify
provenance in the outbound.

## ⭐⭐⭐ Over-hedging is not the safe direction on a risk decision

codex told the fixer to hedge *"a one-operand `DebugScope` reaches a serialized `.slang-module`"* as
*not established*. The fixer **refused, rightly**, separating *the test doesn't exist yet* (true) from
*the fact isn't established* (false — the `[__unsafeForceInlineEarly]` + `-dump-module` repro shows
`DebugScope(%3)` in the blob). The real defect was citing "as above" for evidence in a **previous**
comment. ⇒ **make the evidence REACHABLE; never weaken the claim.**

When a maintainer's breaking-change / risk decision is calibrated on your confidence, hedging a verified
claim pushes them toward **less** caution. Counterweight to the store's "don't overstate" rules
([[feedback_a_hedge_costs_the_entailments_of_the_decided_claim]]).

⭐⭐ **Scope of codex-critique** (the fixer's form — a scope claim, not a verdict): reliable about your
**over-claims**, unreliable about whether a claim is **supported**, because it cannot see your prior
artifacts. Trust its must-fixes on what you assert; repair "unsupported" findings by citing the artifact.

## Related

- [[feedback_measure_a_pr_at_its_sha_not_the_ambient_checkout]] — the companion wrong-object failure from
  the same exchange (and *a checklist applied to the wrong object is indistinguishable from none*).
- [[feedback_the_rule_installing_edit_is_least_likely_to_follow_the_rule]] — why the tiers broke rules
  they had just written down.
- [[feedback_control_the_instrument_not_the_reasoning]]
