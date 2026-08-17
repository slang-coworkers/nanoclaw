---
title: "[approver/calibration] Large author-authored PR self-merged past unresolved static-analysis Major findings — size-cap ABSTAIN confirmed correct"
type: learning
topic: review-approval
source: learnings/1783962279436-approver-calibration-large-author-authored-pr-self.md
---

# [approver/calibration] Large author-authored PR self-merged past unresolved static-analysis Major findings — size-cap ABSTAIN confirmed correct

**Outcome:** slangpy#1063 (Profiler, ~6718 changed lines / 24 files, core C++
sgl/utils/profiler.*) was recorded ABSTAIN_POLICY/CLAUSE_FAIL:tier_eligible across 5
revisions (R0-R4). It then **merged at my R4 decision commit `06912033bb49`**,
**self-merged by the author** (skallweitNV), with `reviewDecision=REVIEW_REQUIRED`
(no independent APPROVE; the one human review, ccummingsNV's, was DISMISSED), and with
CodeRabbit's 2 🟠 Major findings on profiler.cpp (stale cached GPU-recording pointer →
potential use-after-free; end_zone() LIFO mismatch → encoder-state desync) **never
resolved by a later commit** (merged at the same commit they were flagged on).

**Calibration read:** merged ⇒ APPROVED-equivalent per the skill, recorded as the human
verdict on the R4 row. This is NOT a false-safe — the decision was ABSTAIN_POLICY, never
WOULD_APPROVE, and ABSTAIN_POLICY rows are excluded from agreement scoring. The size cap
did exactly its job: it kept the approver from auto-approving a large core-C++ change
that ultimately shipped with unverified Major static-analysis findings and no formal
approving review. Confirms the well-placed-size-cap prior
([[approver-calibration-size-cap]]).

**Transferable signal (the class, not this PR):**
- "merged ⇒ APPROVED" is a WEAKER signal when the merge is an **author self-merge with
  `reviewDecision=REVIEW_REQUIRED`** (no independent human APPROVE). Author self-merge is
  a human acting, but it is not independent review — don't over-weight it as validation
  that the code was vetted. When calibrating future decisions against such an outcome,
  treat "shipped" and "reviewed-and-approved" as distinct.
- A >cap PR that self-merges past unresolved static-analysis Major findings is the exact
  scenario the size cap protects against: had the approver auto-approved on a clean-ish
  review verdict, it would have co-signed shipping unverified potential-UAF/state-desync
  code. Large core-C++ PRs earn ABSTAIN regardless of how clean the bot review looks.
- Practical: check `reviewDecision` and whether `mergedBy == author` when mining a merge
  join — an author self-merge with REVIEW_REQUIRED is a materially different calibration
  data point than a maintainer-approved merge.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783962279436-approver-calibration-large-author-authored-pr-self.md`_
