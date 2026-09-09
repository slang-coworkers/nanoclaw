---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787320726810-b4s0v4
written_at: 2026-09-01T10:16:24.418Z
---

# [approver/clause-gap] Same PR can flip WOULD_APPROVE→ABSTAIN across revisions when the mounted policy changes — decisions are policy-version-relative

**Symptom:** shader-slang/slang#12607 (DCE epoch fix, bot-authored `fix/issue-12605`) was decided WOULD_APPROVE at head `2bb68fec86af` on Aug 21 under policy `v0-shadow-wide`. A `synchronize` on Sep 1 advanced the head to `8cb9a5cc3ebb` (a strictly *better* revision — added `SLANG_ASSERT(liveEpoch!=0)` + a two-directional test with a false-live positive control). Re-running the procedure yielded **ABSTAIN_POLICY / CLAUSE_FAIL:author_trust** — the opposite direction, despite the PR improving.

**Root cause:** the flip was NOT about the PR. eval-clauses.py resolves policy in order: per-PR `<ws>/policy/` → group mount `/workspace/extra/approver-policy/APPROVAL_POLICY.json` → bundled default `scripts/APPROVAL_POLICY.json`. On Aug 21 the group mount existed and was `v0-shadow-wide` (trusted_associations included CONTRIBUTOR). By Sep 1 that mount was **absent**, so the script silently fell back to the bundled conservative default `v0-shadow`, whose trusted set is only `[OWNER, MEMBER, COLLABORATOR]`. The PR author `nv-slang-bot[bot]` is association CONTRIBUTOR → `author_trust` fails.

**How to catch it:** when the same PR/issue re-enters across revisions, check the `policy_version` eval-clauses.py prints, not just the clause pass/fail — a changed policy_version between revisions means the decision baseline moved. A missing group-mount is NOT an infra abstain: eval-clauses.py's fallback to the bundled default is documented/intended, and the clause evaluates cleanly to `fail` (not `unevaluable`), so it is a Policy-family `CLAUSE_FAIL:author_trust`, correctly handled as ABSTAIN_POLICY (hand to human), not `CLAUSE_UNEVALUABLE`.

**Fix / disposition:** Do NOT override a deterministic Step-1 clause with your own judgment even when the change is obviously sound and a human MEMBER already approved — abstain is the safe direction and Step 1 says never judge these yourself. DO flag the policy_version change prominently to the operator so they can confirm the trusted-author narrowing (removal of the wide mount) was intentional vs an accidental unmount. If bot/CONTRIBUTOR-authored PRs should stay approvable, the operator restores/adjusts the mounted policy and the approver re-runs.
