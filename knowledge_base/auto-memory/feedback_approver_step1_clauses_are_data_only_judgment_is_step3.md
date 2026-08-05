---
name: feedback_approver_step1_clauses_are_data_only_judgment_is_step3
description: "Approver Step-1 clauses are mechanical predicates over PR metadata only — anything needing a diff read belongs to Step-3 challenger, or it lands unevaluable and manufactures ABSTAIN_INFRA"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4379ee48-777c-4f8f-b91a-c588ac88f4cb
---

**The approver pipeline has a hard data-vs-judgment boundary, and I asked for a check on the wrong
side of it (2026-08-04).**

- **Step 1 — `eval-clauses.py`, DATA ONLY.** Its own docstring: *"it never judges the code and never
  reasons."* All six clauses are mechanical predicates over PR metadata + changed paths at the
  pinned commit: `author_trust`, `head_provenance`, `commit_match`, `ci_green_on_sha`,
  `no_protected_paths`, `tier_eligible`, plus size caps.
- **Step 3 — challenger + gap severity, JUDGMENT.** Anything requiring a diff to be *read and
  understood* lives here.

**My error:** I asked both approvers to add a *clause* for "does this PR's test plan include a
trigger-present control?" That question requires finding each new flag and locating its setter —
a diff read. **Encoding judgment as a Step-1 clause yields an unimplementable predicate that
evaluates `unevaluable` → spurious `ABSTAIN_INFRA` on EVERY PR**, corrupting the infra-abstain rate
that is supposed to be driven toward 0. My "improvement" would have degraded the pipeline on every
single decision, not just missed its target.

**Why:** a mechanical layer cannot host a claim that needs comprehension; asking it to fail-safes
into abstention, and a blanket abstention is indistinguishable from an outage.
**How to apply:** when proposing an approver behavior change, first ask *does this need the diff
read?* If yes → Step-3 challenger probe (fires **before** the decision). If it's a pure metadata
predicate → Step-1 clause. Landed form for the dead-flag check: a **standing challenger probe**,
with "test plan has no trigger-present control" ⇒ `ABSTAIN_POLICY:OPEN_GAP` (explicitly not a nit).

⭐**A CLAUSE AND A PROBE ARE NOT INTERCHANGEABLE — the layer determines the failure mode.** A
wrongly-placed check does not merely under-perform; it fails in the layer's own idiom (here:
mass abstention).

⭐⭐**A SUBORDINATE TIER REFUSING MY MECHANISM WHILE ADOPTING MY SUBSTANCE IS THE IDEAL RESPONSE
TO A HALF-RIGHT DISPATCH** — the slangpy approver kept the content (negative evidence needs a
positive control; both-directions gating; find the flag's setter; count jobs not passes; check
pipeline order) and rejected both my proposed location (an externally-synced file,
[[feedback_never_edit_externally_synced_skills]]) and my proposed mechanism (clause vs probe). It
also self-audited two prior misses of the same shape (#12098 never-initialized pointer cleared as
"undemonstrated future-proofing," later removed by the maintainer who probed exactly that; and
#11987 — a #11917 slice — recorded WOULD_APPROVE before filing that trigger-present controls are
what that shape needs). **The probe now fires before the decision instead of after.**

⭐⭐**THEREFORE: dispatch WHAT, not WHERE or HOW.** Both corrections here were location/mechanism
errors on my part while the substance was sound. The owner knows their layer boundaries and sync
topology; I do not.

Related: [[feedback_never_edit_externally_synced_skills]]
