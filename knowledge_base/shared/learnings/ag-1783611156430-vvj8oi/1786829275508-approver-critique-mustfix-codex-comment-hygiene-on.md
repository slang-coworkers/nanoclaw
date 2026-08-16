---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786802955928-ufksam
written_at: 2026-08-15T21:27:55.508Z
---

# [approver/critique-mustfix] codex comment-hygiene on the PR author's source is out-of-gate-scope; unresolved -> ABSTAIN_POLICY:CRITIQUE_MUSTFIX, never a forced WOULD_APPROVE

## Symptom
On slang#12560 (clean 4-file compile-perf tooling PR) the codex DECISION_REVIEW/OUTPUT_REVIEW gate returned **must-fix** and held it across 4 rounds — but every remaining must-fix was about the **PR author's source comments** (a dated 2026-08-15 incident narrative in `nightly-mdl-perf-test.yml` and `slack_status.py`), plus the "verbatim review body" contract and a real collector bug in the approver's own script. After the approver-owned items were fixed, codex still blocked on the author's comment hygiene.

## Root cause
Two rubrics collide. The `/codex-critique` skill's developer-instructions carry a comment-hygiene **must-fix** clause scoped "when a code diff is under review", and codex treats the PR diff as under review. But `slang-pr-approver/SKILL.md` scopes the **DECISION_REVIEW** gate to the *derivation only*: "clauses from data, verdict parse matches the review doc, the source tier is stated." The gate is not chartered to re-review the PR's code comments. The approver **never edits the PR**, so a comment-hygiene must-fix is structurally unactionable except by abstaining a clean, correct change.

## How to catch it
When codex's only surviving must-fixes are about the PR author's code/comments (not your derivation artifacts — clauses.json, review-doc.md, harvest.json, investigation.md), recognize it as **out-of-gate-scope**: the gate checks YOUR derivation, not the PR's merge-worthiness. Comment style maps to none of the decision states (🔴 bug / real-trigger 🟡 gap / clean challenger).

## Fix / resolution
An unresolved must-fix **cannot** be recorded as WOULD_APPROVE — SKILL.md Step 4: "A must-fix verdict => revise or ABSTAIN. The soft-cap escalates to a human; it never silently passes," mapping unresolved escalations to `ABSTAIN_POLICY` (`CRITIQUE_MUSTFIX`/`ESCALATED`). Since you can't revise the PR, the terminal state is **ABSTAIN_POLICY:CRITIQUE_MUSTFIX**, escalated to the operator. Do NOT force WOULD_APPROVE to dodge the abstain: this abstain will likely join as a false-abstain (a human merges the clean change), and that is the HONEST signal that the gate's scope needs tightening — gaming it by rounding up to approve violates "never round up to approve." Operator action: clarify whether the PR author's comment-hygiene is in-scope for the approval-decision gate, or restrict the critique gate to the derivation as SKILL.md states. ABSTAIN_POLICY is not itself critique-gated (early return, recorded directly).
