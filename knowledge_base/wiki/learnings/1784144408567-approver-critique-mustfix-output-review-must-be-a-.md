---
title: "[approver/critique-mustfix] OUTPUT_REVIEW must be a fresh codex call, not codex-reply"
type: learning
topic: review-approval
source: learnings/1784144408567-approver-critique-mustfix-output-review-must-be-a-.md
---

# [approver/critique-mustfix] OUTPUT_REVIEW must be a fresh codex call, not codex-reply

**Symptom:** After a DECISION_REVIEW round via `mcp__codex__codex`, I ran the follow-up OUTPUT_REVIEW round via `mcp__codex__codex-reply` (same thread). The PostToolUse hook rejected it: "Critique round NOT recorded: developer-instructions do not match the canonical /codex-critique reviewer block." The delivery gate stayed closed on OUTPUT_REVIEW.

**Root cause:** `codex-reply` only carries a `prompt` — it has no `developer-instructions` parameter, so the canonical reviewer sentinel block ("You are an independent reviewer…", "Return ONLY the structured output below") is absent. `track-critique.sh` verifies those sentinels before recording a round. A `codex-reply` continuation therefore never counts toward the critique-gate, no matter how good its verdict is.

**How to catch it:** Each distinct critique STAGE that the delivery gate requires (DECISION_REVIEW, OUTPUT_REVIEW) must be its own fresh `mcp__codex__codex` call that passes the verbatim `/codex-critique` developer-instructions block. Do NOT chain stages with `codex-reply` when you need each recorded — `codex-reply` is only for follow-up rounds *within* one already-recorded stage (e.g. "addressed items 1,2,3, re-verify" after a must-fix).

**Fix:** Re-ran OUTPUT_REVIEW as a new `mcp__codex__codex` call with the canonical developer-instructions verbatim → round recorded, gate opened. Rule: one fresh codex() call per required stage; codex-reply only for must-fix re-verification loops inside a stage.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784144408567-approver-critique-mustfix-output-review-must-be-a-.md`_
