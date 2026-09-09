---
title: "[approver/human-disagreement] ABSTAIN:OPEN_GAP vs human MERGE on a no-op-default packaging change whose only trigger is an out-of-repo internal build"
type: learning
topic: review-approval
source: learnings/1788781046062-approver-human-disagreement-abstain-open-gap-vs-hu.md
---

# [approver/human-disagreement] ABSTAIN:OPEN_GAP vs human MERGE on a no-op-default packaging change whose only trigger is an out-of-repo internal build

---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788515015611-lnx4ox
written_at: 2026-09-07T11:37:26.062Z
---

# [approver/human-disagreement] ABSTAIN:OPEN_GAP vs human MERGE on a no-op-default packaging change whose only trigger is an out-of-repo internal build

**Outcome.** slangpy#1141 (one-line `version += os.environ.get("SLANGPY_VERSION_SUFFIX","")`
in setup.py): I recorded ABSTAIN_POLICY:OPEN_GAP on R3 and again on R4. Humans
**merged R4 unchanged** (mergedBy ccummingsNV, maintainer skallweitNV had
approved) — the merged head == my exact decision commit, no follow-up commits.
So human verdict = APPROVED-equivalent; my decision diverged (abstain, not a
false-safe — this is the other direction).

**My rationale (abstain).** The suffix-PRESENT path is the PR's entire stated
purpose, yet verified by nothing in-repo: no setter for the env var, `ci.py`
builds via CMake and never executes the changed root setup.py, no wheels job on
PR. Real trigger, wheel-publication blast radius, zero in-repo proof ⇒ OPEN_GAP.

**Human rationale (merge).** The env var is set only by the maintainers'
out-of-repo/internal build (that IS what "internal wheel version suffixes"
means). Verification legitimately lives there, outside this repo's CI. The
no-op-when-unset default makes all public builds risk-free, and the present-path
logic is a plain string concat they trust and exercise in their own pipeline.

**Transferable takeaway (sharpens Step-0 recall).** For this CLASS — a trivial,
additive, no-op-by-default packaging/versioning change whose only new behavior is
gated by an env var set exclusively by an out-of-repo build — the in-repo
verification gap is REAL but **unclosable inside the repo by design**, and
maintainers will predictably merge such changes. This is the abstain *working as
intended* (flag → human decides with knowledge you lack), NOT a miscalibration to
fix by flipping to WOULD_APPROVE. Do not round this class up. The one concrete
sharpening: phrase the abstain's next-action as "verify via the internal/out-of-repo
build — cannot be shown in this repo's CI," so it reads as a correctly-scoped
hand-off rather than a defect the author can close in-repo. Also: on a merge-join,
check whether follow-up commits landed between your decision commit and the merged
head — here none did, confirming the humans accepted the exact code you flagged.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1788781046062-approver-human-disagreement-abstain-open-gap-vs-hu.md`_
