---
title: "[approver/clause-gap] Autodiff zero-differential must use getDifferentialZeroOfType, never emitDefaultConstructRaw — a probe for any PR touching dzero/tangent synthesis"
type: learning
topic: review-approval
source: learnings/1784017388229-approver-clause-gap-autodiff-zero-differential-mus.md
---

# [approver/clause-gap] Autodiff zero-differential must use getDifferentialZeroOfType, never emitDefaultConstructRaw — a probe for any PR touching dzero/tangent synthesis

**Symptom:** slang PR #11670 (fix zeroed primal in trivial forward derivative) synthesized the forced-zero tangent for inout/out DifferentialPair params via `builder.emitDefaultConstructRaw(diffSlotType)`, while the sibling return-pair branch in the SAME function used `getDifferentialZeroOfType(&builder, valueType)`. This divergence is a latent silent-miscompile: for a user type conforming to `IDifferentiable` with a custom `dzero()` whose zero ≠ default-construct (e.g. an additive identity of 42, not 0), `emitDefaultConstructRaw` produces the WRONG tangent because it never calls the user's `dzero()`. Three independent signals converged on it (production bot 🟡 gap, Devin flag, a COLLABORATOR's CHANGES_REQUESTED); the author fixed it in a follow-up commit "use getDifferentialZeroOfType" + a `CustomZeroFloat dzero()=42` regression test.

**Root cause / rule:** in Slang autodiff, the differential "zero" (additive identity) of a type is defined by `IDifferentiable.dzero()`, NOT by default/bitwise initialization. `getDifferentialZeroOfType` dispatches to the user's `dzero()` (and recurses for pairs/arrays/existentials); `emitDefaultConstructRaw` just default-constructs the storage. They coincide ONLY for scalars (float/int) whose dzero == default. Any code path that materializes a zero tangent must use `getDifferentialZeroOfType`.

**How to catch it (transferable challenger probe):** for ANY PR that synthesizes or writes back a zero/identity differential (trivial fwd derivatives, missing-tangent fill-in, out-param writeback, IRUndefined handling), grep the diff for `emitDefaultConstruct`/`emitDefaultConstructRaw` used as a *differential* value. If found, it's a red flag unless the differential type is provably always a scalar. Then check the test suite: does it exercise a **user IDifferentiable type with a non-default `dzero()`**? A test that only covers `float`/`int` differentials cannot distinguish the two emission paths — that coverage hole is exactly where this class of bug hides. This is the same "guarded/simple path is not a template for the general input class" meta-lesson as the runtime-loop-induction learnings.

**Fix:** decision-wise, a zero-differential-via-default-construct divergence is a real OPEN_GAP (plausible trigger, real blast radius, silent) — ABSTAIN unless a custom-dzero test proves the path. When the fix lands (both sites use getDifferentialZeroOfType + a custom-dzero regression test asserting the non-default zero), it clears to WOULD_APPROVE.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784017388229-approver-clause-gap-autodiff-zero-differential-mus.md`_
