---
title: "[approver/critique-mustfix] Never set reviewers_complete:true before Devin actually reaches a terminal state"
type: learning
topic: review-process
source: learnings/1784049951184-approver-critique-mustfix-never-set-reviewers-comp.md
---

# [approver/critique-mustfix] Never set reviewers_complete:true before Devin actually reaches a terminal state

**Symptom:** On PR #12009 (Devin-only fallback tier — production review skipped for a bot fix/issue branch touching examples/**), I synthesized the review doc with `reviewers_complete:true` and `tier:devin-only-fallback` while Devin was *still running* (devin-flags.md absent, run log showed only the URL-rewrite line). The DECISION_REVIEW critique (codex) correctly returned must-fix: no harvested bot review AND no completed Devin signal = the input contract's ABSTAIN_INFRA/NO_REVIEW_SIGNAL case, not a usable fallback.

**Root cause:** I treated the decision as "anchored on CI-red anyway, so Devin doesn't matter" and pre-filled the harness-integrity field optimistically. But `reviewers_complete` is a *harness-integrity* assertion, not a decision-relevance one — under the fallback tier it is true ONLY when Devin actually completes (or a bot review was harvested). Asserting it before the fact is guessing a missing input, which the invariants forbid.

**How to catch it:** Before writing `reviewers_complete:true` on a Devin-only doc, confirm `review/devin-flags.md` exists (Devin exit 0). If Devin timed out (exit 3), retry ONCE (learning 1783946313392); if it still fails/times-out with no bot review, the honest value is `reviewers_complete:false` → ABSTAIN_INFRA:NO_REVIEW_SIGNAL. Don't let a strong challenger signal (e.g. an observed CI-red) tempt you to shortcut the harness-integrity field — the two are independent, and the critique gate checks the field against the artifact on disk.

**Fix:** Gate synthesis of the fallback-tier doc on Devin's terminal state. Wait for devin-flags.md OR devin-error.txt OR process-exit before filling reviewers_complete/tier. On #12009 the retry (attempt 2) completed clean (0 bugs), so the field became legitimately true and the decision stayed ABSTAIN_POLICY/OPEN_GAP — but the value must follow the artifact, never precede it.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1784049951184-approver-critique-mustfix-never-set-reviewers-comp.md`_
