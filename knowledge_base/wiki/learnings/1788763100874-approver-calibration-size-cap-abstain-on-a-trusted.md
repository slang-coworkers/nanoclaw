---
title: "[approver/calibration] Size-cap ABSTAIN on a trusted-author, capability-gated new-API PR that then merged unchanged — cap is well-calibrated"
type: learning
topic: review-approval
source: learnings/1788763100874-approver-calibration-size-cap-abstain-on-a-trusted.md
---

# [approver/calibration] Size-cap ABSTAIN on a trusted-author, capability-gated new-API PR that then merged unchanged — cap is well-calibrated

---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788526373847-uh6se5
written_at: 2026-09-07T06:38:20.874Z
---

# [approver/calibration] Size-cap ABSTAIN on a trusted-author, capability-gated new-API PR that then merged unchanged — cap is well-calibrated

**Context.** shader-slang/slangpy#1142 ("Add cluster acceleration structure API",
1283 lines, author skallweitNV = trusted MEMBER). I decided
`ABSTAIN_POLICY:CLAUSE_FAIL:tier_eligible` (1301 changed lines > 400 auto-approve
cap). The PR then **merged at the exact commit I decided on**
(`head_sha == decision commit d26bf46ff754`, zero intervening commits, self-merged
by the author). Host auto-joins merged ⇒ APPROVED-equivalent.

**Calibration read.** My abstain was a *policy deferral on size*, not a code
verdict — so an approval by the human is NOT a false-safe and NOT a
disagreement. It is the system working as designed: the tier_eligible cap routed
a large, novel-API change to a human, who approved it. The cap earned its keep
here rather than being an over-conservative nuisance.

**Transferable signal (sharpens Step-0 recall).** Large (>400-line) *new-feature
API* PRs from trusted maintainers that are properly capability-gated, and whose
risky path is *hardware-gated and unavailable in CI* (here: cluster AS behind
`Feature.cluster_acceleration_structure`, e2e tests `pytest.skip` without the
device), commonly merge unchanged at the reviewed head. For the auto-approver:
- ABSTAIN-on-size is the correct, expected outcome for this shape — don't agonize
  over rounding it toward WOULD_APPROVE; the cap exists precisely for novel large
  APIs a bot can't fully vet.
- A **self-merge by the author does NOT independently validate** the parts a green
  CI can't reach — the GPU-descriptor↔driver layout (TriangleClusterArgs bitfield
  packing) and the never-exercised-in-CI cluster build path. So the two leads I
  surfaced for the human remain legitimate even though they didn't block the
  maintainer; "merged unchanged" ≠ "those risks were verified", it means the
  author was confident.
- Practical: when the merged head equals your decision commit, there is no
  "follow-up commits" diff to mine — the shipped change *is* what you saw, so the
  calibration is clean and binary.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1788763100874-approver-calibration-size-cap-abstain-on-a-trusted.md`_
