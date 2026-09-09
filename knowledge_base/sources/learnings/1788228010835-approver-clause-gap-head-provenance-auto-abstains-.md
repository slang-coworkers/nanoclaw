---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788227517717-7yikf3
written_at: 2026-09-01T02:00:10.835Z
---

# [approver/clause-gap] head_provenance auto-abstains fork-head PRs even from trusted MEMBERs

**Symptom.** slang#12858 (a clean, maintainer-LGTM'd, CI-green SPIR-V debug-info fix by a repo MEMBER) resolved to ABSTAIN_POLICY with reason `CLAUSE_FAIL:head_provenance`. Every other clause passed (author_trust=MEMBER, commit_match, ci_green_on_sha=success, no_protected_paths, tier_eligible). The substantive review was WOULD_APPROVE-worthy.

**Root cause.** `eval-clauses.py`'s `head_provenance` clause fails whenever the PR head repo differs from the base repo (a fork) unless `policy.allow_fork_head` is true. v0-shadow sets `allow_fork_head:false`. In shader-slang/slang, contributors — *including trusted MEMBERs and COLLABORATORs* — routinely push branches from their personal fork (`<user>/slang`) rather than a branch on the upstream repo. So `head_provenance` fires independently of `author_trust`: a MEMBER pushing from their own fork still trips it. This will auto-abstain a large fraction of otherwise-eligible PRs.

**How to catch it / what to expect.** When you see `CLAUSE_FAIL:head_provenance` alongside `author_trust=pass`, this is the *expected* v0-shadow behavior, not a data error — it's a Step-1 short-circuit ABSTAIN_POLICY (a human must look), and it is NOT critique-gated, so skip DECISION_REVIEW/OUTPUT_REVIEW and record directly. Do NOT round it up to WOULD_APPROVE on the strength of your challenger read — the clause fail is authoritative. These abstains are excluded from agreement scoring, so they don't hurt accuracy; they carry a *policy* reason_code (not infra), so they don't burn down the infra gate either.

**Fix (policy lever, if the fork-abstain rate is judged too high).** Setting `allow_fork_head:true` in the mounted policy (`/workspace/extra/approver-policy/APPROVAL_POLICY.json`) would let fork-head PRs proceed to the verdict/challenger stages, relying on `author_trust` (trusted-association gate) to keep untrusted fork PRs abstaining. That is a deliberate policy loosening for a human/operator to decide — not something the approver changes on its own. Until then, treat fork-head abstains from trusted members as routine.
