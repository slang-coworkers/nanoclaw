---
title: "[approver/calibration] Trusted-author 'fix warnings' PRs touching only protected build/CI-config merge as-is — protected-path ABSTAIN is correct routing but is the policy's dominant cost class"
type: learning
topic: review-approval
source: learnings/1788767903720-approver-calibration-trusted-author-fix-warnings-p.md
---

# [approver/calibration] Trusted-author "fix warnings" PRs touching only protected build/CI-config merge as-is — protected-path ABSTAIN is correct routing but is the policy's dominant cost class

---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788764272875-bx34gf
written_at: 2026-09-07T07:58:23.720Z
---

# [approver/calibration] Trusted-author "fix warnings" PRs touching only protected build/CI-config merge as-is — protected-path ABSTAIN is correct routing but is the policy's dominant cost class

## Confirmed-safe join (shader-slang/slangpy#1144, "Fix warnings")

**Decision → outcome.** Both revisions I saw resolved to ABSTAIN_POLICY
(CLAUSE_FAIL:no_protected_paths); the PR then **merged at exactly my rev-2
decision commit `c0befefbd7af`** — merged by the author skallweitNV (MEMBER),
**0 follow-up commits after my decision commit, 0 formal PR reviews** (requested
reviewer kaizhangNV never reviewed; author self-merged). Merge = APPROVED-
equivalent; the change class was safe and needed nothing.

**This is NOT a mismatch.** An ABSTAIN routed the PR to a human, who approved —
the workflow working as designed. It is not a false-safe (I never asserted
WOULD_APPROVE) and not a BLOCK-vs-approved disagreement. Recording it only as a
calibration data point.

## The class of signal (transferable)

The change shape: a **trusted-author (OWNER/MEMBER) "fix warnings" / housekeeping
PR** whose *only* eligibility blocker is that it touches **protected build/CI-config
paths** — here `CMakeLists.txt` (a guarded `if(POLICY CMP0177)` policy opt-in that
is a no-op on older CMake) and `.github/workflows/checks.yml` (a GHA
`actions/upload-artifact@v4`→`@v7` version bump) — alongside test-only / shader-
constant edits, with **clean bot + Devin reviews (0 bugs/flags)**. Under v0-shadow
this deterministically ABSTAINs (`no_protected_paths`) and never reaches the
verdict/challenger. The merge-as-is outcome confirms this class is low-risk.

## How this sharpens the next review

- This is the **dominant cost class** of the conservative protected-path clause:
  it abstains on changes that humans merge verbatim. Shadow mode is *measuring*
  exactly this — track the protected-path-abstain → merged-as-is rate for this
  class; a persistently high rate is the evidence a narrower rule would need.
- If/when the policy is widened (human sign-off required — not the approver's
  call), the candidate carve-out is: guarded CMake-policy additions and GHA
  action version bumps by trusted authors with clean reviews. Until then the
  ABSTAIN is correct.
- Caveat worth a human eye even in this "safe" class: a GHA action **major-version
  bump to a tag that may not exist** (e.g. `upload-artifact@v7`) is exactly the
  kind of thing a protected-path human review is for — do not treat "trivial
  warning fix" as "no risk in the CI-config touch."

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1788767903720-approver-calibration-trusted-author-fix-warnings-p.md`_
