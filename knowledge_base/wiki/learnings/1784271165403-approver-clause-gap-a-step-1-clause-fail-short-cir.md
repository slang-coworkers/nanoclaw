---
title: "[approver/clause-gap] A Step-1 clause FAIL short-circuits to ABSTAIN_POLICY even when the challenger has already verified a BLOCK-class defect — the skill ordering governs, don't invent a 'BLOCK overrides clause-fail' exception"
type: learning
topic: review-approval
source: learnings/1784271165403-approver-clause-gap-a-step-1-clause-fail-short-cir.md
---

# [approver/clause-gap] A Step-1 clause FAIL short-circuits to ABSTAIN_POLICY even when the challenger has already verified a BLOCK-class defect — the skill ordering governs, don't invent a "BLOCK overrides clause-fail" exception

**Symptom:** slang#12136 fix-push revision @ 04d90845. While verifying the fix I confirmed from CI a NEW PR-caused red-CI build break (sanitizer link failure). Clauses were 5-PASS but `tier_eligible` FAILED (3355 lines > 2000 cap). I initially recorded **BLOCK** (RED_BUG), reasoning that "the eligibility clauses gate the approve/round-up direction and must not suppress a verified defect into a softer verdict; BLOCK is strictly more conservative than ABSTAIN." The DECISION_REVIEW critique (codex) flagged it must-fix: SKILL.md:57 says any clause FAIL => ABSTAIN_POLICY, and SKILL.md:75 says the Step-3 challenger runs ONLY if Steps 1–2 pass. So a `tier_eligible` FAIL short-circuits to **ABSTAIN_POLICY:CLAUSE_FAIL** *before* the challenger — there is no sanctioned path for a challenger BLOCK to override it.

**Root cause:** I treated "more conservative" as license to pick the verdict I thought most truthful, but the skill is a deterministic procedure of record, not a menu. The eligibility clauses are a hard gate: when one fails, the decision IS the clause fail, full stop. My "clauses only gate approval" theory is not in the skill — inventing it would make the procedure non-deterministic and un-auditable.

**Why ABSTAIN is still safe here:** ABSTAIN_POLICY routes the PR to a human (exactly what a size-cap breach + a verified build break both warrant), and it doesn't round up to approve. Nothing is lost by recording the clause fail as the *reason* — as long as the verified defect is preserved as human-facing CONTEXT (I put the SIGSEGV-fix confirmation + the sanitizer break in the decision's challenger/next_action fields and the [Approval Decision] message, and kept the review-doc's embedded verdict primary-faithful). The signal reaches the human; only the taxonomy label differs.

**How to catch it:** Run `eval-clauses.py` and check for any FAIL BEFORE forming a challenger verdict. If a clause fails, the recorded decision is ABSTAIN_POLICY:CLAUSE_FAIL:<name> regardless of what else you found — record the defect as context, not as the decision reason. Only escalate a defect to BLOCK when Steps 1–2 PASS and the challenger (Step 3) runs.

**Also (artifact hygiene, same review):** the review-doc.md's embedded `_approver_result` and prose are the *review-verdict source* — they must carry ONLY the harvested primary/Devin synthesis (here bugs:0/gaps:4/questions:1). Do NOT inject challenger findings (the sanitizer break) into the review-doc; they belong in investigation.md and the decision's challenger field. Mixing them contaminates the Step-2 parse. Codex flagged this twice before it was clean.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784271165403-approver-clause-gap-a-step-1-clause-fail-short-cir.md`_
