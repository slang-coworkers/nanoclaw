---
title: "[approver/critique-mustfix] SV legalization order-gaps: check front-end narrow-integer admissibility before clearing"
type: learning
topic: review-approval
source: learnings/1789087706199-approver-critique-mustfix-sv-legalization-order-ga.md
---

# [approver/critique-mustfix] SV legalization order-gaps: check front-end narrow-integer admissibility before clearing

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789074862130-1ccc68
written_at: 2026-09-11T00:48:26.199Z
---

# [approver/critique-mustfix] SV legalization order-gaps: check front-end narrow-integer admissibility before clearing

## Symptom
On slang#12884 (Fix SV_InstanceID on Metal), the head-current production review flagged
🟡 "no test for SV_StartInstanceLocation declared before SV_InstanceID (order-sensitive
path)". My first challenger pass cleared it as pure coverage: `findSystemValueParam` is
order-agnostic, the emitted sub is inserted at `getFirstOrdinaryInst` (all params
dominate), and both orders converge to `int(i) - int(base)` — so I called it order-
independent and moved to WOULD_APPROVE. The DECISION_REVIEW critique gate (codex) rejected
that: the equivalence holds ONLY for 32-bit types.

## Root cause
Two independent facts combined into a real, silent correctness bug the tests masked:
1. The front-end `isSemanticTypeCompatible` (slang-check-shader.cpp:112-140) validates a
   system-value's user type by CATEGORY only (integer / float / bool) — NOT bit width. So a
   narrow integer like `uint16_t base : SV_StartInstanceLocation` (or int16/uint64) is
   ADMITTED. A new diagnostic that rejects `uint2` proves nothing here — it rejects a
   VECTOR shape, not a narrow scalar.
2. `legalizeSystemValueParameters` processes work items in PARAM ORDER; each item's normal
   legalization coerces the param to `permittedTypes` (here {UInt=32}) and redirects the
   param's *snapshotted* uses through a conversion to the user's declared type. When a
   special handler (SV_InstanceID) creates a use of another param (the reused base) BEFORE
   that param's own legalization runs, the later legalization redirects the shared operand
   through a truncating round-trip. Net: base-after-instance → operand
   `cast<u32>(cast<u16>(base))` (truncates); base-before-instance → `base_u32` (no
   truncation). For base_instance ≥ 65536 with a uint16 base the two orders differ, one
   wrong. All PR tests used 32-bit int/uint, so neither order exposed it.

## How to catch it
When clearing an "order"/"coverage" gap on any system-value or varying-param legalization
that does type coercion (a `permittedTypes` + `tryConvertValue` path), ALWAYS ask: does the
front end admit a NARROW or WIDER integer than the legalization's permitted type? If the
semantic-type check is category-only (the common case in slang), narrow/wide integers reach
legalization and its width conversions can interact with work-item processing order. "Both
orders converge" is a claim about a SPECIFIC width — re-run the trace with a narrow type
before clearing. A missing positive control that varies type width (not just entry-point
order) is an OPEN_GAP, not a nit.

## Fix (for the decision procedure)
Treat order+coercion gaps on SV legalization as OPEN_GAP unless a test exercises BOTH the
untested order AND a non-32-bit type — the tested 32-bit path is not evidence for the narrow
path. General rule: an emitted-code equivalence argument is only as strong as the type
widths it was traced over; enumerate the admissible widths from the front-end category rule,
not from the tests present.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1789087706199-approver-critique-mustfix-sv-legalization-order-ga.md`_
