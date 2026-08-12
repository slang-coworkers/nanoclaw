---
title: "[approver/human-agreement] fixer-issue-learning-predicts-correct-fix-shape-clears-challenger"
type: learning
topic: review-approval
source: learnings/1784307794563-approver-human-agreement-fixer-issue-learning-pred.md
---

# [approver/human-agreement] fixer-issue-learning-predicts-correct-fix-shape-clears-challenger

**Symptom / setup:** slang#11665 (bot-authored `fix/issue-11664`, "reject operator names on variables and parameters") came in on the Devin-only tier (harvest exit 20 — production review skips bot fixer branches). WOULD_APPROVE (CLEAN) recorded @8c3a3ee1, mode=live_late.

**Root observation (transferable):** When the *fixer* who triaged an issue left a durable learning about **what the principled fix should look like**, Step-0 recall surfaces it and it becomes the sharpest challenger prior you can have. Here the recall learning [slang ParseDeclName shared by func and var accepts operator names] said the correct fix must (a) reject at the **commit point / single choke point**, NOT the shared name-reader, and (b) **spare legit operator functions**. The PR did exactly that: rejected at `UnwrapDeclarator` (the one point every C-style declarator flows through) gated by a `bool allowOperatorName` opt-in passed *only* by the function branch — and added a positive companion test asserting operator functions still compile. The recall *predicted the diff*.

**How to catch it (the class):** For a fixer PR whose issue you (or a peer) previously triaged, grep the learnings for the issue number FIRST — a prior "the correct fix should be X at layer Y" note lets the challenger verify the diff *matches the predicted shape* rather than re-deriving from scratch. Cross-check the companion learning [slang parser-diagnostic gotchas] too: distinct token per occurrence to defeat sink dedup (test used +,-,*,/,%,& — verified), and header-vs-body-phase suppression (negatives global-scope + one param in its own header — verified).

**Diagnostic-rename false-safe guard (reusable):** This PR renamed #11775's diagnostic (code E20020) **in place** rather than adding a second. Two things to verify by direct inspection when a diagnostic is renamed: (1) `git grep` the OLD C++ symbol across source/ + include/ → must be zero dangling refs (a leftover ref = compile break CI would catch, but confirm early); (2) exactly ONE occurrence of the numeric code in slang-diagnostics.lua after rebase — slang#11609 added a build-time code-uniqueness check, so a duplicate 20020 (e.g. if the PR *added* rather than *edited* the line, or a merge left both #11775's and this one's) fails `reuse-compliance-check`. Confirm the PR head is rebased on current master (merge-base == origin/master) so you're checking the shipped state.

**Fix / outcome:** All 3 Devin informational items refuted-or-out-of-scope by source inspection; full CI green (44 success / 2 skipped / 0 fail) incl. all test-slang-rhi variants (the #12141 slang-rhi-submodule false-safe class — a parser/diagnostic change can break the bundled submodule's tests; here it cleared on every platform). Decision joined on merge/close.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784307794563-approver-human-agreement-fixer-issue-learning-pred.md`_
