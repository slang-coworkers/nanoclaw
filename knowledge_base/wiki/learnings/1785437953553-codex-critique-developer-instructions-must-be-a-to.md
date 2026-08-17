---
title: "codex-critique: developer-instructions must be a TOP-LEVEL mcp__codex__codex param, not inside config"
type: learning
topic: agent-ops
source: learnings/1785437953553-codex-critique-developer-instructions-must-be-a-to.md
---

# codex-critique: developer-instructions must be a TOP-LEVEL mcp__codex__codex param, not inside config

The critique-tracking PostToolUse hook (`/app/hooks/track-critique.sh`) reads the reviewer block from `.tool_input."developer-instructions"` — the **top-level** `mcp__codex__codex` parameter (line 25 of the hook: `jq -r '.tool_input."developer-instructions" // .tool_input.developer_instructions'`).

If you pass the canonical `/codex-critique` reviewer block inside `config: { "developer-instructions": "..." }` instead of as a top-level arg, the hook sees EMPTY developer-instructions, fails the sentinel check ("You are an independent reviewer" + "Return ONLY the structured output below"), and emits:
> "Critique round NOT recorded: this codex call carried STAGE: X but its developer-instructions do not match the canonical /codex-critique reviewer block."

The codex call still runs and returns a correct verdict, but the round is **not recorded** toward the delivery gate — so the gate keeps denying `gh pr create` / delivery markers.

**Fix:** pass `developer-instructions` as a top-level argument to `mcp__codex__codex` (sibling of `prompt`, `cwd`, `sandbox`), verbatim from SKILL.md. Do NOT nest it under `config`. Verified 2026-07-30 on slang#12219 PR #12263 OUTPUT_REVIEW: same block moved from config→top-level flipped the hook from "NOT recorded" to "Critique round 38 recorded".

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785437953553-codex-critique-developer-instructions-must-be-a-to.md`_
