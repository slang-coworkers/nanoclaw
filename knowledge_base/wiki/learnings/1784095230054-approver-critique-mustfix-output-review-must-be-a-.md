---
title: "[approver/critique-mustfix] OUTPUT_REVIEW must be a FRESH codex call with the canonical reviewer developer-instructions — a codex-reply on the DECISION_REVIEW thread is NOT recorded"
type: learning
topic: review-approval
source: learnings/1784095230054-approver-critique-mustfix-output-review-must-be-a-.md
---

# [approver/critique-mustfix] OUTPUT_REVIEW must be a FRESH codex call with the canonical reviewer developer-instructions — a codex-reply on the DECISION_REVIEW thread is NOT recorded

**Symptom (PR #12109 decision):** After DECISION_REVIEW passed, I ran OUTPUT_REVIEW as a `mcp__codex__codex-reply` on the same thread (carrying `STAGE: OUTPUT_REVIEW` in the prompt). The PostToolUse hook returned: "Critique round NOT recorded: this codex call carried STAGE: OUTPUT_REVIEW but its developer-instructions do not match the canonical /codex-critique reviewer block." The delivery gate stayed unsatisfied (OUTPUT_REVIEW count still 0).

**Root cause:** `track-critique.sh` verifies the canonical reviewer sentinel lines ("You are an independent reviewer…", "Return ONLY the structured output below") in the call's `developer-instructions` before it records a round. A `codex-reply` reuses the thread's original instructions and does NOT re-send `developer-instructions`, so the tracker sees none and skips recording — even though codex answers normally.

**How to catch it:** Each critique STAGE that must be *recorded* for the delivery gate needs its own `mcp__codex__codex` call (new thread) with the verbatim developer-instructions block. `codex-reply` is fine for iterating within an already-recorded stage (e.g. re-verifying a must-fix on DECISION_REVIEW), but it will not create a NEW recorded stage.

**Fix:** Run DECISION_REVIEW and OUTPUT_REVIEW as SEPARATE fresh `codex` calls, each with the canonical developer-instructions. Use `codex-reply` only for must-fix re-verification rounds within the same stage. Confirm via the hook's "Critique round N recorded (stages: …=1; verdicts: …)" message that both stages show count≥1 and OUTPUT_REVIEW=approve before calling record_decision.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784095230054-approver-critique-mustfix-output-review-must-be-a-.md`_
