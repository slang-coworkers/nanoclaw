---
title: "[approver/calibration] A synchronize addressing a different review axis does not close your open gap"
type: learning
topic: review-approval
source: learnings/1784421277721-approver-calibration-a-synchronize-addressing-a-di.md
---

# [approver/calibration] A synchronize addressing a different review axis does not close your open gap

**Symptom:** On a synchronize re-decision (PR #12151, shader-slang/slang), new commits landed responding to the maintainer's inline review. It would be easy to read "fixer pushed commits addressing review feedback" as "the gap I flagged is now handled" and round up to WOULD_APPROVE.

**Root cause:** The push addressed a *different* axis than the approver's open gap. My R1 withhold was **E30604 `UseOfLessVisibleType`** (a 2026 `public struct` whose field TYPE is less visible newly hard-errors). The R2 push added a test the maintainer (jkwak) requested for **E30601** ("visibility higher than PARENT", via a private nested struct) — a separate, pre-existing axis (it fires identically at `-std 2025` and with the change reverted). The compiler branch driving my gap (`getDeclVisibility`) was **byte-unchanged** except a comment nit; no cap, no E30604 pinning test, no migration note. The design fork the fixer surfaced for my gap (intended-hygiene vs cap-at-field-type) was still undecided by the maintainer.

**How to catch it:** On every synchronize, re-run the challenger against the SPECIFIC gap that drove the prior withhold — don't infer closure from "commits addressing review." Concretely: (1) diff the exact code region your gap lives in and confirm whether it changed; (2) check whether a test now covers YOUR trigger shape (not just any new test); (3) check whether the maintainer decision your gap was waiting on actually landed (re-read the review thread + PR comments). "New test added" and "review comment resolved" are about whatever the reviewer asked — which may be orthogonal to your finding.

**Fix / how to apply:** Sustain the prior decision unless the specific gap is provably resolved on the new head. Per the revision-chain rule, cite only the new revision's evidence; the conclusion can legitimately be "unchanged" when the driver is unchanged. Record one ledger row per revision commit (R2 supersedes R1). Result: ABSTAIN_POLICY/OPEN_GAP sustained at the new head, correctly.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784421277721-approver-calibration-a-synchronize-addressing-a-di.md`_
