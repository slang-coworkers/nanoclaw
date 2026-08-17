---
title: "[approver/human-agreement] R2 BLOCK → narrowed fix → merge-APPROVED = shadow BLOCK vindicated end-to-end (#12111)"
type: learning
topic: review-approval
source: learnings/1784675820614-approver-human-agreement-r2-block-narrowed-fix-mer.md
---

# [approver/human-agreement] R2 BLOCK → narrowed fix → merge-APPROVED = shadow BLOCK vindicated end-to-end (#12111)

**Symptom / context:** PR #12111 (coalesce redundant UniformConstant resource loads, #12051) ran a full 3-round shadow lifecycle that ended in a clean human-agreement join, validating the shadow reviewer against a real maintainer outcome:
- **R1 @4e78df9c WOULD_APPROVE** — Layer B (SPIR-V legalizer `insertLoadAtLatestLocation`, dominance-by-construction, descriptor-heap getElement loads only).
- **R2 @c6d14f514141 BLOCK (RED_BUG)** — maintainer (csyonghe/jkwak) redirected the fix to Layer A: `isMovableInst` keyed on `AddressSpace::UniformConstant` ALONE. That over-fired on plain combined-sampler *globals* and regressed the UNMODIFIED `intrinsic-texture.slang.6/.7/.8` (`-target spirv`) on 8 test-slang legs. Devin (0-bug) missed it; my challenger's CI-vs-master probe caught it.
- **R3 @6c4f5389 WOULD_APPROVE** — fixer narrowed the predicate to additionally require `load->getPtr()->getOp() == kIROp_GetElementPtr` (element access only). CI on the settled head went all-16-legs-green; intrinsic-texture.6/.7/.8 + the updated straight-line desc-handle-load-reuse PASS.
- **Terminal join:** MERGED by jkwak-work (maintainer) @exact head 6c4f5389, reviewDecision=APPROVED (explicit jkwak APPROVED review, not self-merge — author is nv-slang-bot). `record_human_verdict=APPROVED` → **agreement on both the R2 BLOCK (the over-fire was real, fixed before merge) and the R3 re-APPROVE (matches the human APPROVED)**.

**Root cause / why this is the transferable lesson:** This is the canonical proof that a shadow BLOCK on a CI-regression is high-value even when the reviewer route was maintainer-directed. The maintainers themselves chose Layer A (over jkwak's own documented "all-target blast radius" caveat); the shadow reviewer's CI probe is what surfaced the concrete over-fire, and the fix that shipped is the *narrowed* form. The discriminator that made R2→R3 decidable was always **the live test-slang CI diffed against master**, never Devin (which does not build/run tests) — the same lesson as [[pr-12122-decided]]/[[pr-12141-decided]], now confirmed by a merge outcome.

**How to catch / apply it next time:**
1. On any "move the same fix to a more generic predicate" revision, the blast radius widens *within the target* even when cross-target is dead-code-safe — enumerate every other IR shape matching the new predicate and diff the live test-slang legs vs master. A newly-red UNMODIFIED, not-expected-failure test = verified 🔴 = BLOCK regardless of a clean review doc.
2. A `kIROp_<Op>` direct-immediate-pointer check is *stronger and safer* than a `getRootAddr(ptr)!=ptr` address-walk: it sidesteps the getRootAddr op-set false-safe class ([[getRootAddr-op-set]]/#11152) entirely, and its failure direction is safe (a miss = lost optimization, not a miscompile). Prefer/expect the direct-op form when reviewing element-access narrowing predicates.
3. **Never record on a non-settled head.** This PR's head moved THREE times near my record step (7211fb01 force-pushed away; e2b42bca torn down by session teardown before record — both left NO ledger row, which was correct). Only 6c4f5389 settled long enough to record. The "wait for settled-head CI, hold rather than record on partial" gate directly prevented recording against two superseded heads. When a teardown/restart interrupts you at the near-terminal position, on resume RE-VERIFY head-unchanged + CI-still-green before recording — do not assume the pre-teardown state holds.
4. Session teardown at the critique-gate/record step is a recurring failure mode here. The derivation + CI evidence were complete pre-merge, so recording post-merge (then joining the human verdict) is honest, NOT outcome-fitted — but state that explicitly to the critique gate so it audits the derivation on its merits.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784675820614-approver-human-agreement-r2-block-narrowed-fix-mer.md`_
