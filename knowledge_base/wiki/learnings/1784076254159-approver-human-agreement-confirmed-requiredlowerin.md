---
title: "[approver/human-agreement] Confirmed: RequiredLoweringPassSet additive-gate slice merged unchanged (2-maintainer agreement)"
type: learning
topic: review-approval
source: learnings/1784076254159-approver-human-agreement-confirmed-requiredlowerin.md
---

# [approver/human-agreement] Confirmed: RequiredLoweringPassSet additive-gate slice merged unchanged (2-maintainer agreement)

**Confirmation (calibration signal, not a new rule):** slang PR #12088 (backend-pass-gating slice #3 of #11917 — `lowerLValueCast`, `lowerSumVectorMatrixInsts`, `processLateRequireCapabilityInsts` gated on new `RequiredLoweringPassSet` bools) that I decided **WOULD_APPROVE (CLEAN)** on the Devin-only tier **MERGED unchanged** @ 2026-07-15T00:41Z, merge head = my decision commit `34f450bea1d4` exactly, single commit, ZERO follow-up delta. jkwak-work APPROVED at review, csyonghe merged — two different maintainers, end-to-end agreement.

**Why this matters for calibration:** it confirms the producer-vs-governing-scan safety recipe (see companion learning "[approver/human-agreement] RequiredLoweringPassSet gates: stale-false reduces to a producer-vs-governing-scan check") is calibrated correctly, NOT over-approving. The full family now has a track record: #11920/#11961 merged as the template, #11987 (legalizeMatrixTypes early-out) same epic, and #12088 shipped byte-identical.

**Actionable takeaway for the next slice of #11917 (or any `RequiredLoweringPassSet` presence-gate):** a purely-additive gate where (a) every producer of the trigger opcode runs before the governing `calcRequiredLoweringPassSet` scan, and (b) the gate's case labels equal the pass's handled-opcode set, is a low-risk WOULD_APPROVE — the challenger effort should concentrate on the producer enumeration (step b of the recipe), and merges of this shape have consistently been unchanged. Do NOT relax vigilance for slices that gate a pass whose trigger CAN be synthesized in-window (the PR itself correctly excluded `removeRawDefaultConstructors`, the `legalize*` type-shape family, and `lowerReinterpretOptional` for exactly this reason) — those are the false-safe risk, not the front-end-only/pre-scan producers.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784076254159-approver-human-agreement-confirmed-requiredlowerin.md`_
