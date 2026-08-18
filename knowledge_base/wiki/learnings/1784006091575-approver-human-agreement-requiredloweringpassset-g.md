---
title: "[approver/human-agreement] RequiredLoweringPassSet gates: stale-false reduces to a producer-vs-governing-scan check"
type: learning
topic: review-approval
source: learnings/1784006091575-approver-human-agreement-requiredloweringpassset-g.md
---

# [approver/human-agreement] RequiredLoweringPassSet gates: stale-false reduces to a producer-vs-governing-scan check

**Symptom / context:** slang PR #12088 (slice #3 of #11917, after merged #11920/#11961) gated three more backend passes — `lowerLValueCast`, `lowerSumVectorMatrixInsts`, `processLateRequireCapabilityInsts` — on new `RequiredLoweringPassSet` bool flags. WOULD_APPROVE (CLEAN); human jkwak-work independently APPROVED (agreement).

**Root cause of why this class is safe (the transferable lesson):** `calcRequiredLoweringPassSet` in slang-emit.cpp only ever assigns flags `= true` (never `= false`); the sole zero-init is `requiredLoweringPassSet = {}` (slang-emit.cpp:1024, before the post-link scan). The later post-specialization scan (~:1472) is purely ADDITIVE/OR-accumulate, NOT a reset — despite PR prose loosely calling both "reset". Consequence: a flag reaches a call site `false` ONLY if the trigger opcode was absent at every scan up to that site. Therefore **stale-false (the only miscompile hazard for a presence-gate; stale-true is a harmless extra no-op walk) is impossible unless a producer synthesizes the trigger opcode AFTER the governing scan (the last scan before the call site).**

**How to catch it (fast challenger recipe for any RequiredLoweringPassSet gate):**
1. Identify the call site's governing scan (post-link @~1025 vs post-specialization @~1472 — whichever is the last scan before the call-site line).
2. Enumerate EVERY producer of the gated pass's trigger opcode(s) across source/ (IRBuilder emit* methods + emitIntrinsicInst with that kIROp).
3. For each producer, ask only: does it run in the window (governing scan → call site)? Front-end AST→IR producers (slang-lower-to-ir.cpp) always run before linkAndOptimizeIR ⇒ safe. An IR-pass producer is safe only if it runs before the governing scan (e.g. autodiff transpose runs inside finalizeAutoDiffPass @~1409, before scan2 @~1472 ⇒ sumVectorMatrix safe).
4. Confirm gate = pass's handled-opcode-set exactly (case labels not narrower than what the pass rewrites).
Any in-window producer ⇒ stale-false ⇒ BLOCK. This is exactly why the PR correctly LEFT UNGATED `removeRawDefaultConstructors` (DefaultConstruct synth'd in-window by legalize-types/glsl-legalize), the legalize* type-shape family, and `lowerReinterpretOptional` (ReinterpretOptional synth'd in-window by typeflow specialization) — a bool flag can't express a type-shape, and in-window synthesis defeats a frozen flag.

**Fix / rule:** For this gate family, the whole correctness question is producer-timing, not diff size. A diagnostic-only pass (e.g. processLateRequireCapabilityInsts — diagnoses+removes existing insts, no synthesis) is doubly safe: false flag = pure no-op, drops no diagnostic. Links: [[approver-human-agreement-purely-additive-gate-pass]] (the merged #12050/#11920 precedent this extends).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784006091575-approver-human-agreement-requiredloweringpassset-g.md`_
