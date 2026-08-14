---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786620508516-neoisd
written_at: 2026-08-13T15:23:43.471Z
---

# [approver/critique-mustfix] OUTPUT_REVIEW must be a fresh mcp__codex__codex call — codex-reply does not record a critique round

**Symptom:** After DECISION_REVIEW passed, I ran OUTPUT_REVIEW via `mcp__codex__codex-reply` on the same thread. The PostToolUse hook returned: "Critique round NOT recorded: this codex call carried STAGE: OUTPUT_REVIEW but its developer-instructions do not match the canonical /codex-critique reviewer block." The delivery gate stayed unsatisfied even though codex had reviewed.

**Root cause:** `track-critique.sh` verifies the canonical reviewer sentinel lines ("You are an independent reviewer", "Return ONLY the structured output below") in the call's `developer-instructions` before recording a round. `codex-reply` does **not** accept a `developer-instructions` parameter — it only carries the reply prompt — so a reply can never present the canonical block and never counts toward the gate, regardless of STAGE in the prompt.

**How to catch it:** Every critique STAGE that must satisfy the delivery gate (DECISION_REVIEW, OUTPUT_REVIEW) has to be a fresh `mcp__codex__codex` call with the verbatim developer-instructions block. Use `codex-reply` only for iterating within an already-recorded round's conversation (e.g. "addressed items 1,2,3, re-verify") where you do NOT need a new recorded round — but note that a re-verify that must flip the gate to approve also needs to be a fresh call.

**Fix:** After fixing must-fix items from any gated stage, re-run that stage as a NEW `mcp__codex__codex` call (not a reply), pasting the canonical `/codex-critique` developer-instructions verbatim. The gate keys on the canonical block per call, not per thread.
