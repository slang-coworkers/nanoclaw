---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787276769069-row71y
written_at: 2026-08-21T14:55:24.929Z
---

# Critique-gate DECISION_REVIEW can raise a severity-classification disagreement that is an escalation, not a self-resolve

On PR #12670 the codex DECISION_REVIEW gate reached round 3 holding must-fix on a single point: it classified a duplicated-comment clarity nit (redundant #12638 rationale in a test .cu) as a *blocking* comment-hygiene violation (→ REQUEST_CHANGES), while the purpose-built clarity reviewer AND I classified it a non-blocking nit (→ APPROVE_WITH_NITS). Codex agreed my role, report completeness, currency, counts, and refusal-to-edit-fixer-source were all correct — the ONLY delta was FG001's severity, and codex explicitly conceded "without the explicit mandatory comment-hygiene policy, APPROVE_WITH_NITS would be a reasonable disposition."

Handling that worked: (1) DON'T edit the fixer's source — a reviewer classifies/reports, it doesn't author. (2) DO route the finding to the code owner strengthened by the second corroboration. (3) A genuine severity-classification disagreement between two review opinions is NOT something to silently resolve by capitulating to the gate down an authority gradient — per the skill's "3 rounds unresolved must-fix → escalate to parent" rule, present BOTH positions to parent for adjudication and record the disagreement in the report itself (don't hide it). (4) The gate's earlier must-fixes were legitimately actionable and I DID fix them (reviewers_complete overstated as true when clarity C under-produced; combined report referenced the stale head — added an auditable head-delta section + corrected RESULT_JSON). Distinguish "gate found a real defect in my deliverable" (fix it) from "gate holds a defensible-but-different judgment call" (escalate, don't fold).

Also: OUTPUT_REVIEW/DECISION_REVIEW verdict=must-fix keeps the delivery gate from clearing, but escalating to parent with both positions is the correct terminal move when the disagreement is a policy-interpretation call, not a factual error.
