---
title: "[approver/human-agreement] website-content PR OUT_OF_SCOPE confirmed by genuine human approval+merge"
type: learning
topic: review-approval
source: learnings/1784325987979-approver-human-agreement-website-content-pr-out-of.md
---

# [approver/human-agreement] website-content PR OUT_OF_SCOPE confirmed by genuine human approval+merge

**Symptom:** A content PR on `shader-slang/shader-slang.github.io` (the Slang website repo) routes to the approver as a reviewable-PR webhook. It sails through all 6 mechanical clauses as PASS and harvest returns exit 20 `{found:false}` (production `claude-pr-review.yml` doesn't run on the website repo). This looks identical to the `ABSTAIN_INFRA:NO_REVIEW_SIGNAL` trigger and can be mistaken for either INFRA or (with a human approval present) WOULD_APPROVE.

**Root cause:** The clauses carry no repo-class predicate; all-pass ≠ in-scope. The approval harness (production bot code review + code-CI clauses + Devin code review + code challenger) is built for the *compiler* domain, not website content.

**How to catch it:** Make a **class determination FIRST**, prior to and overriding the review-signal (`reviewers_complete`) mapping. Out-of-scope content (Markdown/prose/asset/config on the website repo) is a **POLICY** boundary → `ABSTAIN_POLICY` with `reason_code=OUT_OF_SCOPE:website-content`. NOT `ABSTAIN_INFRA` (pipeline didn't fail; PR is out of domain) and NEVER `WOULD_APPROVE` (no applicable code-review signal — don't round up even when a human already approved). Freshly verify the diff touches only content surface (no `_config`, CI, or build-affecting code) — the class hinges on that. Don't run Devin theater over prose. Stamp `decision`/`reason_code`/`class` explicitly into the `_approver_result` block or codex OUTPUT/DECISION_REVIEW flags the INFRA-vs-POLICY ambiguity.

**Fix / calibration delta from PR #204:** PR #207 ("Link neural shading course slides", bmillsNV, `landing/siggraph-26/index.md` +2/−0 one PDF link) decided ABSTAIN_POLICY:OUT_OF_SCOPE:website-content @2d125818, mode=live_late. Unlike #204 (SIGGRAPH blog post, self-merged → `MERGED_SELF_NO_REVIEW`, NOT a calibration signal), #207 carries a **genuine human APPROVED review by swoods-nv at the exact head** plus a merge by a *different* actor. That IS a real human-verdict join = **AGREEMENT** (withhold-on-out-of-scope was correct; not a false-safe — we withheld rather than approved, and the human independently approved the content). Lesson: a website-content ABSTAIN_POLICY that later gets a genuine (non-self) human approval+merge is a *vindicated* withhold, and worth recording as agreement calibration; distinguish it from a self-merge (which is neither agreement nor disagreement).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784325987979-approver-human-agreement-website-content-pr-out-of.md`_
