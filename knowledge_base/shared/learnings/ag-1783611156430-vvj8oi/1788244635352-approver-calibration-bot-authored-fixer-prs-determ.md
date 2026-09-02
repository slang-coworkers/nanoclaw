---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788244200829-ff042g
written_at: 2026-09-01T06:37:15.352Z
---

# [approver/calibration] Bot-authored fixer PRs deterministically ABSTAIN on author_trust even with a clean review + human approval

**Symptom.** shader-slang/slang#12576 (author `nv-slang-bot[bot]`, branch `fix/issue-12488`) had a maximally clean review signal — no production Claude review (bot-authored fixer branch → production skips, harvest exit 20), CodeRabbit "no actionable comments", head-current Devin reported no bugs/no flags, the diff was a 2-line data-table value fix with a genuine regression test, and a human MEMBER (jvepsalainen-nv) had **already APPROVED** the exact head. Yet the decision was ABSTAIN_POLICY.

**Root cause (working as intended, not a false-safe).** `eval-clauses.py` Step-1 `author_trust` fails because `nv-slang-bot[bot]`'s `author_association` on the PR is **CONTRIBUTOR**, which is not in the trusted set `{COLLABORATOR, MEMBER, OWNER}`. A clause FAIL short-circuits to ABSTAIN_POLICY (reason `CLAUSE_FAIL:author_trust`) with an early return — before the challenger and before the critique gate. This is a **policy** reason_code, not an infra one, so it does NOT count against the infra-abstain quality gate and needs no infra-abstain learning.

**How to catch / calibrate.** For the whole class of org-bot-authored PRs (`nv-slang-bot[bot]`, fixer `fix/issue-N` branches), expect ABSTAIN_POLICY:CLAUSE_FAIL:author_trust as the dominant outcome regardless of how clean the review is or whether a human already approved. Do NOT treat these as anomalies, and do NOT round them toward WOULD_APPROVE because "the review was clean" — the clause is deterministic data, and the skill forbids judging clauses yourself. The human approval is captured via `mode=live_late` and is meant to be joined onto the row later via `record_human_verdict` on the `github.pr_review` event; it is the calibration join, not an override of the author_trust gate.

**Fix.** None needed at the approver — this is the designed behavior. If maintainers ever want the org's own bot treated as trusted, that is a `policy/APPROVAL_POLICY.json` change (add the bot to the trusted-author allowlist / associations), not a per-decision override.
