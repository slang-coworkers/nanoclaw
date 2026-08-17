---
title: "[approver/human-disagreement] Temporary maintainer-authored test-disable: bundled-coverage OPEN_GAP is real but low-severity — maintainers merge the trade-off"
type: learning
topic: review-approval
source: learnings/1785282531686-approver-human-disagreement-temporary-maintainer-a.md
---

# [approver/human-disagreement] Temporary maintainer-authored test-disable: bundled-coverage OPEN_GAP is real but low-severity — maintainers merge the trade-off

**Context:** slangpy#1076 (whole-`TEST_CASE` `doctest::skip()` of two flaky profiler tests, TODO→#1073). My shadow decision = **ABSTAIN_POLICY / OPEN_GAP** — the skip also dropped deterministic cross-thread/closing-state frame-rejection coverage (test_profiler.cpp:358/360) as collateral. Outcome: the author/maintainer `jkwak-work` **merged the PR unchanged** (single commit `3598937bfe9c`, no follow-up commits, no assertion split). Human verdict = APPROVED.

**Both rationales:**
- *Mine (abstain):* a whole-case skip silences deterministic, uniquely-covered assertions beyond the flaky ones it targets → surface to a human before auto-approving.
- *Human (merge):* accepted the temporary collateral coverage loss as-is, given a tracked re-enable (#1077) and the flake actively breaking scheduled CI. Did not bother splitting the flaky snapshot/counting section out.

**Calibration lesson (transferable):** For the CLASS of *maintainer-authored, temporary, tracked test-disables* (skip/xfail with a TODO/issue pinning re-enable), the "bundled deterministic coverage lost as collateral" gap is a **legitimate OPEN_GAP but a low-severity one** — informed maintainers routinely merge it rather than split assertions. So:
- Keep flagging it — it's a real, grep-verifiable coverage loss, and abstain (not approve) remains the correct shadow call; never round up.
- But frame it as *"confirm this temporary trade-off"*, not *"this likely shouldn't merge."* Weight it toward the lenient end of OPEN_GAP: the loss is temporary, tracked, and the alternative (leave CI flaking) is worse.
- The abstain is NOT a miss here — it routed a real trade-off to a human, who resolved it. Abstain-vs-merge is the procedure working, not a false-safe (that label is reserved for WOULD_APPROVE → CHANGES_REQUESTED).

**How this sharpens Step-0 recall:** next time a maintainer temporarily disables their own flaky test with a tracked re-enable, recognize the gap early, verify sibling-suite coverage (cross-language too), and record OPEN_GAP with a "temporary/tracked → low-severity, confirm-the-trade-off" framing rather than an implied block.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785282531686-approver-human-disagreement-temporary-maintainer-a.md`_
