---
title: "Reviewing a pass-gating PR: green tests plus byte-identical output cannot detect a dead flag"
type: learning
topic: review-process
source: learnings/1785827882400-reviewing-a-pass-gating-pr-green-tests-plus-byte-i.md
---

# Reviewing a pass-gating PR: green tests plus byte-identical output cannot detect a dead flag

# A gate test needs a control proving the flag FIRED

**Audience: anyone reviewing or approving a PR that gates a compiler pass behind a flag**
(`RequiredLoweringPassSet` and friends in shader-slang/slang, but the shape is general).
⚠️ **PROVENANCE CORRECTED TWICE 2026-08-04 (author). Final, verified form:** the `assumeAddress` dead
flag was **real — but as a transient in-development state of the batch-2 draft (PR #12336), caught by
its author before publication. It never reached `master` or any remote ref.**

I got this wrong in both directions before landing here, which is the more useful lesson: first filed
as *"derived from a real defect"* (implying a shipped artifact — wrong), then over-corrected to
*"never shipped… a prospective hazard in unwritten work"* (implying it never happened — also wrong).
Evidence for each half: positive control at `master` shows `RequiredLoweringPassSet`
(`slang-code-gen.h:52-88`) with 34 flags, all having setters and none named `assumeAddress`; and
PR #12336's own body states *"An **earlier draft** of this change added an `assumeAddress` flag… and
never set it."*

⭐**"It happened" and "it shipped" are different claims, and over-correcting a false "shipped" into a
false "never" is the same error with the sign flipped — a retraction is itself a claim owing
evidence.** ⭐**A prospective "gate on X when it lands" needs a mechanism; "X shipped" needs an
artifact — don't let the first borrow the authority of the second.**

**The rule below is sound and the checks are correct; read "observed" as "observed in development,
pre-publication".** It now has a shipped regression test behind it —
`tests/diagnostics/get-address-validation-gpu.slang` guards the `assumeAddress` gate — plus
independent in-tree evidence that the drill really is blind:
`tests/hlsl/lower-lvalue-cast-skip.slang` states in its own comment that skip-vs-run *"is a
compile-time-only property that is not observable in emitted output."*

## The blind spot

The standard safety evidence for a gating PR is:

1. test suites pass, and
2. a **revert-drill**: emitted output is byte-identical to the ungated build.

Both can be green while the gate is completely broken — specifically when the flag is **declared,
gated on, but never set** because the scan has no arm for the triggering opcode. Then:

- The gated pass **never runs**, on any input.
- Nothing it would have done gets done — in the **predicted** case a diagnostic is silently lost and
  an `AssumeAddress` instruction reaches the backend. (Predicted, not observed: see the provenance
  note above. Worse in the concrete instance than "dead" implies — the gate site precedes the
  struct's reset/scan, and the 34 bools are **uninitialized**, so a too-early read is
  **indeterminate**, not reliably false.)
- The revert-drill is **green by construction**: a pass that skips everything changes nothing, so
  emission is trivially identical.
- Tests pass, because no test asserted the pass had run.

The drill validates that a gate **does not break things**. It cannot validate that the gate
**works**. Those are different claims, and only the first is being measured.

## What to require instead

**Scope this to PRs that add a NEW FLAG AND A NEW GATE.** A **widening-only** change — no new flag,
only new `case` labels broadening an existing flag false→true — is **monotone**: it cannot create a
dead flag and cannot skip a needed pass. Precedent: shader-slang/slang#12050 @`4c507cb94ca3`,
approved and merged unchanged. ⭐**A probe that fires on the safe direction of a change class is a
false-abstain generator — it costs exactly as much as the miss it was meant to prevent.**

For every flag a gating PR introduces, require a **positive control**: a test on a module that
genuinely contains the trigger, demonstrating the flag was set and the pass executed. Both
directions are needed (fires-positive alone would miss a **stuck-on** flag; the cross-off column
excludes that second failure mode):

| direction | shows |
|---|---|
| trigger ABSENT → pass skipped | the optimization actually fires (the point of the PR) |
| trigger PRESENT → pass ran | the flag is reachable — **this is the one that catches a dead flag** |

Concretely, when reviewing:

- **Match the scan arms against the gated set.** For each new flag, find the `case` in the scan
  function that sets it. A flag with no setter is dead. This is a **diff read** — no amount of
  drilling substitutes for it.
- **Count the jobs, not the passes.** A pass may do more than one unconditional thing; gating it on
  a flag covering only the first silently disables the second. (Confirmed in source:
  `lowerUntaggedUnionTypes`' second job at `slang-ir-lower-dynamic-dispatch-insts.cpp:755`. Note the
  matching *claim* — that this was already a shipped must-fix — **was measured false**: neutering
  that case label still compiled, because a broader implication set the flag anyway, and a 60-test
  sweep found no isolating shape. **A second job is a place to look, not a defect by itself.**)
  One control per *job*, not per pass.
- **Beware a pass that is gated on a flag set by a scan that runs after it.** Check the pipeline
  order, not just the presence of the arm.

## Why this matters for approval decisions specifically

An approver working from "CI green + byte-identical revert-drill + no reviewer objections" has
**no signal at all** on this failure mode. The evidence is not weak, it is structurally
inapplicable. A dead-flag gate is indistinguishable from a working gate by every artifact an
approval pipeline normally consumes — so the absence of red flags is not evidence of a live gate.

If a gating PR's test plan contains no trigger-present control, that is a **specific, nameable
gap** worth raising (or abstaining on), not a stylistic nit.

## Related

Same family as *a zero without a non-zero control is not evidence*: here the "zero" is the
byte-identical diff, and the missing control is a run in which the gate demonstrably fired. See
also the wrong-instant-measurement learning from the same epic — both are cases where a clean
measurement was structurally incapable of returning any other answer.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1785827882400-reviewing-a-pass-gating-pr-green-tests-plus-byte-i.md`_
