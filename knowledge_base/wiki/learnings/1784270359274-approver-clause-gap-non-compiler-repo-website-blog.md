---
title: "[approver/clause-gap] Non-compiler repo (website/blog/docs) is ABSTAIN_POLICY:OUT_OF_SCOPE, not INFRA — clauses have no repo-class predicate"
type: learning
topic: review-approval
source: learnings/1784270359274-approver-clause-gap-non-compiler-repo-website-blog.md
---

# [approver/clause-gap] Non-compiler repo (website/blog/docs) is ABSTAIN_POLICY:OUT_OF_SCOPE, not INFRA — clauses have no repo-class predicate

**Symptom:** A `pr_ready_for_review` dispatch routed a PR from `shader-slang/shader-slang.github.io` (the website/blog repo, not slang/slang-rhi/slangpy) to the approver. It was a 19-line Jekyll markdown blog post (SIGGRAPH 2026 announcement) + a logo image. `harvest-reviews.py` returned exit 20 (`{found:false}` — production `claude-pr-review.yml` doesn't run on the website repo), Devin is a code reviewer with nothing to say about prose, and `eval-clauses.py` reported **all 6 clauses PASS** (trusted author, same-repo head, no protected paths, within size caps).

**Root cause:** The approval harness — production bot review + compiler-CI clauses + Devin + code challenger — is built to assess *compiler-code* correctness (IR/emit/ABI/type-system/tests). None of it applies to a content PR. The deterministic clauses carry **no repo-class predicate**, so an out-of-scope content PR sails through all six as PASS. And the review-doc's `reviewers_complete:false` (no code-review signal produced) looks identical to the `ABSTAIN_INFRA:NO_REVIEW_SIGNAL` trigger — the INFRA path that's meant for an *in-scope* PR whose review pipeline failed.

**How to catch it:** When the tasking repo is not a compiler repo (website/blog/docs/content), make a **class determination first**, before the review-signal mapping. Out-of-scope class is a *policy* boundary (human/content owner reviews editorial content, the bug-review harness doesn't), so it's `ABSTAIN_POLICY` with `reason_code=OUT_OF_SCOPE:<class>` — NOT `ABSTAIN_INFRA:NO_REVIEW_SIGNAL` (the pipeline didn't fail; the PR is simply out of domain) and NOT `WOULD_APPROVE` (no applicable signal; never round up). The class determination is *prior to and overrides* the `reviewers_complete` mapping. Stamp `decision`/`policy_abstain`/`reason_code` explicitly into the `_approver_result` block so the recorded decision doesn't drift to the generic INFRA path (codex OUTPUT/DECISION_REVIEW flags this ambiguity if you don't).

**Fix:** For any non-compiler repo dispatch: record `ABSTAIN_POLICY` / `OUT_OF_SCOPE:<class>` (the four-state enum is closed; `reason_code` carries the free-form detail — within contract per SKILL.md "the enum never grows per-cause"). Don't force compiler-CI clauses to manufacture a verdict, and don't run Devin theater over prose. The dispatch itself often steers this way for content-PR-out-of-policy cases.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784270359274-approver-clause-gap-non-compiler-repo-website-blog.md`_
