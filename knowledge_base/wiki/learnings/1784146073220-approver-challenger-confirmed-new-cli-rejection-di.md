---
title: "[approver/challenger-confirmed] New CLI-rejection diagnostics that defer to the emitter's own fold are safe by construction"
type: learning
topic: review-approval
source: learnings/1784146073220-approver-challenger-confirmed-new-cli-rejection-di.md
---

# [approver/challenger-confirmed] New CLI-rejection diagnostics that defer to the emitter's own fold are safe by construction

**Symptom / shape:** A PR adds a new *parse-time command-line rejection* diagnostic (here #12122 E00046, rejecting an explicit `-capability` that would raise the emitted target version above an explicit `-profile`). New rejections are the scariest class to auto-approve because the dangerous failure direction is FALSE POSITIVE — breaking a previously-valid command line — not false negative.

**How to clear it (the probe that decides):** Ask whether the rejection predicate is *re-derived by hand* or *deferred to the same production code path it is guarding*. #12122's `capabilityRaisesTargetVersionAboveProfile` mirrors the base `TargetRequest::getTargetCaps()` fold verbatim (`if (!targetCap.isIncompatibleWith(toAdd)) targetCap.join(toAdd);`, slang-target.cpp:230-231), then reads back the emitted version. Because it uses the SAME join/emission the compiler already uses, the diagnostic fires iff the emitted version would otherwise silently rise — no hand-coded requirement to drift out of sync. Verify: (1) it truly calls the same helper, not a reimplementation; (2) the comparison is strict (`>` not `>=` — equal is not a conflict); (3) an early-out drops out-of-scope inputs the base path also drops (`isIncompatibleWith` for disjoint families); (4) the common case is guarded (`Profile::Unknown` when no `-profile`); (5) the test carries PASSING controls at the boundary and just-above, not only the failing cases.

**Why it's safe:** a "defer to the real fold" rejection cannot over-reject relative to the behavior it guards — if any realization keeps the version, the join keeps it and the check stays silent. A missed conflict just preserves the pre-existing silent behavior (non-regressing).

**Bonus check when the test's conflict example depends on a capdef fact in flux:** #12122's conflict example is `spvShaderInvocationReorderNV` needing SPIR-V 1.5. A sibling PR (#12097/#12115) aims to lower that to 1.4, which would make the test's conflict stop conflicting. Confirm the capdef state AT THE PR HEAD (`SPV_EXT_shader_invocation_reorder : _spirv_1_5`) and that the sibling PR is still OPEN — a human reviewer (jkwak) flagged this as a forward-looking test-maintainability concern, correctly advisory (COMMENTED, not blocking): the test passes today; it will need updating when the sibling lands, but that is a future edit, not a current bug. Don't upgrade a forward-looking test-brittleness note to OPEN_GAP.

Result: WOULD_APPROVE / CLEAN. Confirmed: this shape (emitter-deferring CLI rejection + boundary test controls) is safe to approve; the human review agreed it's mergeable (advisory nits only).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784146073220-approver-challenger-confirmed-new-cli-rejection-di.md`_
