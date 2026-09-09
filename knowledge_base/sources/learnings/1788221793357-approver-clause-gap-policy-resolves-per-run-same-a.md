---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787299482318-1dzuw8
written_at: 2026-09-01T00:16:33.357Z
---

# [approver/clause-gap] policy resolves per-run: same author can flip trusted→untrusted between revisions; empty group mount falls back to bundled default

**Symptom:** A PR decided WOULD_APPROVE at R1 came back as a `synchronize` revision (R2, a master-catchup merge). At R2 the Step-1 `author_trust` clause FAILED and forced ABSTAIN_POLICY / CLAUSE_FAIL:author_trust — for the SAME author (`nv-slang-bot[bot]`, association CONTRIBUTOR) that passed at R1. Nothing in the PR's own diff caused it. Example: shader-slang/slang#12538 (R1 `66e928c7` WOULD_APPROVE 08-21; R2 `25dca720` ABSTAIN 09-01).

**Root cause:** `eval-clauses.py` resolves the policy fresh each run in this order: `--policy` → per-PR `<ws>/policy/APPROVAL_POLICY.json` → group mount `/workspace/extra/approver-policy/APPROVAL_POLICY.json` → **bundled default `scripts/APPROVAL_POLICY.json`**. The group mount dir was EMPTY, so both runs used the bundled default — but the bundled default itself changed between runs: R1 clauses ran under `v0-shadow-wide` (trusted set included CONTRIBUTOR, FIRST_TIMER, NONE, …); R2 resolved to `v0-shadow` with `trusted_associations: [OWNER, MEMBER, COLLABORATOR]` (CONTRIBUTOR NOT trusted). The bundled file's mtime had moved (whole skill dir re-synced), but authoritative policy history isn't available to the approver — so assert only the resolved-policy difference, not intent or a change date.

**Why it's the RIGHT decision (not a bug):** the clause gate is data-only and precedes the verdict parse. A clean substantive review (here: Devin 0/0, over-rejection shield intact, only a forced-consistent E31228→E31229 diagnostic renumber vs R1) does NOT override an eligibility failure. CLAUSE_FAIL:author_trust is a Policy-family abstain ("the system working as intended, hand to a human") — and indeed a human MEMBER had already APPROVED at that head. Early-return: skip challenger/critique, record directly.

**How to catch / handle it:**
1. On every revision, RE-READ the `clauses.json` `policy_version` and the `author_trust` evidence string — do not assume the prior revision's policy still applies. Policy is resolved per-run.
2. If a bot/CONTRIBUTOR-authored fixer PR abstains on author_trust while the substance is clean, that's expected under a COLLABORATOR+-only trusted set — record ABSTAIN_POLICY/CLAUSE_FAIL:author_trust, don't fight it.
3. Empty `/workspace/extra/approver-policy/` is the DEFINED fallback to the bundled default, not an infra defect — so it's CLAUSE_FAIL (policy), NOT CLAUSE_UNEVALUABLE/infra. Verify the mount before classifying.
4. Do NOT round a policy-ineligible PR up to WOULD_APPROVE just because R1 approved or a human approved; the eligibility gate is the point.

**Also (delivery-gate friction, minor):** the `[Approval Decision]` send is gated by `gate-critique-on-deliver.sh` on the marker + edits-since-critique EVEN for ABSTAIN rows (record_decision relaxes the gate for ABSTAIN, but the send hook doesn't). Practical fix: run one OUTPUT_REVIEW critique round on the ABSTAIN decision + message, then resend. Costs one codex round.
