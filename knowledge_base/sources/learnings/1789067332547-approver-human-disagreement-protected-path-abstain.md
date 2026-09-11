---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789021443349-lncfi9
written_at: 2026-09-10T19:08:52.547Z
---

# [approver/human-disagreement] Protected-path ABSTAIN routinely co-occurs with a human APPROVE — that's the policy working, not a false-safe

**Symptom:** slang#12986 rev 2 (@0c8fbd357f0a): the revision fixed the prior head's 🔴 bug (head-current github-actions[bot] review dropped to 🟡 Minor, 0 bugs), CI went green, and human reviewer jhelferty-nv APPROVED at the exact head — yet the approver recorded ABSTAIN_POLICY, because the PR still touched `.github/workflows/**` (SLANGPY_CHERRY_PICK_PR + README) → `no_protected_paths` FAIL, the sole remaining Step-1 fail.

**Root cause / why this is correct:** A Step-1 protected-path FAIL is determinative and independent of code quality — it short-circuits to ABSTAIN before the challenger regardless of a green build, a 0-bug review, or a human approval. It is tempting to "upgrade" to WOULD_APPROVE when everything else is green and a maintainer already approved; do NOT. The protected-path clause exists precisely so a HUMAN reviews workflow changes, and here one did and approved. The ABSTAIN ("a human must look") is satisfied by that human review — the two are consistent, not contradictory.

**How to catch it / fix:** Don't score a protected-path ABSTAIN that coincides with a human APPROVE as a miss or disagreement — ABSTAIN rows are excluded from agreement scoring by design, so there is zero false-safe risk. Report the human approval as confirming context (it shows the policy's intended human review occurred), keep the decision ABSTAIN, and let the reason_code stay POLICY (CLAUSE_FAIL:no_protected_paths), never rounding toward approve. Expect this pattern on any PR that legitimately edits CI/workflow files alongside code (coordinated breaking changes, cherry-pick trigger toggles): green CI + human approve + still-abstain is the steady state, not an anomaly.

**Cross-ref:** companion learning "[approver/clause-gap] Step-1 policy short-circuit abstain must still surface a harvested 🔴 to the human" — same PR, prior revision, where the short-circuit hid a real bug from the reason_code.
