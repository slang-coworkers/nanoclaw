---
title: "[approver/human-agreement] closed-unmerged by the AUTHOR for 'obsoleted by future refactoring' is NOT a false-safe — distinguish strategic-obsolete from defect-rejection before scoring a WOULD_APPROVE against a close"
type: learning
topic: review-approval
source: learnings/1784268042791-approver-human-agreement-closed-unmerged-by-the-au.md
---

# [approver/human-agreement] closed-unmerged by the AUTHOR for "obsoleted by future refactoring" is NOT a false-safe — distinguish strategic-obsolete from defect-rejection before scoring a WOULD_APPROVE against a close

**Context (PR #12109, WOULD_APPROVE @ 00bdbc62):** After I recorded WOULD_APPROVE (CLEAN) on the SpecializationWorkList-via-scratchData PR, a `github.pr_closed` webhook arrived with `merged:false`. The naive mapping (closed-unmerged ⇒ CHANGES_REQUESTED-equivalent) would flag this as a candidate false-safe on my approval.

**What actually happened (verified via REST after GraphQL/`gh pr view` returned transient HTTP 401):**
- The **author himself** (pdeayton-nv) closed it, not a maintainer. Closing comment: *"Closing this for now as there will be larger refactoring around specialization in the future that will obsolete this."*
- **Zero human reviews** ever (reviewDecision=REVIEW_REQUIRED throughout; all 4 "reviewed" timeline events were bots: CodeRabbit + github-actions at both heads). No CHANGES_REQUESTED, no defect cited.

**Why it is NOT a false-safe:** A false-safe = WOULD_APPROVE where a human found a real defect. Here the code was independently verified clean (both bot tiers 0 bugs; my challenger verified the scratchData bit-2 safety + arena-model UAF proof), and the non-merge was a **strategic direction change** ("superseded by future work"), not a correctness rejection. This is the SAME class as [[pr-11323-decided]] (closed-unmerged "fix the producer later" = vindicated HOLD). Record `human_verdict=CLOSED_UNMERGED_AUTHOR_OBSOLETE`, not a plain CHANGES_REQUESTED.

**How to catch it (the transferable rule):** On any `pr_closed merged:false` join, BEFORE scoring your decision against it, check TWO things via REST (the issue timeline + comments endpoints — these keep working even when GraphQL/`gh pr view` throws HTTP 401 Bad credentials):
1. **Who closed it** (`issues/<n>/timeline` → `event==closed` actor): author-close ≠ maintainer-rejection.
2. **Why** (the closing comment) and **was there any human review** (`event==reviewed` with a non-`[bot]` login). No human review + author-close-for-strategy ⇒ the merge outcome carries NO signal about your decision's correctness — it is calibration-neutral / mild vindication (code was fine, direction changed), never a false-safe.
Only a human CHANGES_REQUESTED or a maintainer close citing a defect turns a WOULD_APPROVE into a false-safe to mine.

**Also:** the synchronize R2 (head 7cb3c61b) only DELETED a unit test (`irSerializationClearsScratchData` — the sole end-to-end test of the serialization SLANG_DEFER anti-leak invariant); compiler source was byte-identical to R1. R2's decision was never recorded (session torn down mid-wait for its primary review, then the PR closed). Losing that test would have warranted a conservative lean had R2 reached a decision — worth remembering that a synchronize can REDUCE coverage on a load-bearing invariant, which is a reason to re-scrutinize, not cache-hit.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784268042791-approver-human-agreement-closed-unmerged-by-the-au.md`_
