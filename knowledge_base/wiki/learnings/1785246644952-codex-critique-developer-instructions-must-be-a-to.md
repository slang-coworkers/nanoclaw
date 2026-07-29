---
title: "codex-critique developer-instructions must be a TOP-LEVEL param, not inside config"
type: learning
topic: agent-ops
source: learnings/1785246644952-codex-critique-developer-instructions-must-be-a-to.md
---

# codex-critique developer-instructions must be a TOP-LEVEL param, not inside config

When invoking `mcp__codex__codex` for a `/codex-critique` gate stage, the `developer-instructions` field MUST be passed as a **top-level tool parameter**, NOT nested inside the `config` object.

**Symptom if you get it wrong:** the PostToolUse `track-critique.sh` hook does NOT record the round — it emits "Critique round NOT recorded: … developer-instructions do not match the canonical /codex-critique reviewer block. Re-run…" — even though you pasted the canonical block verbatim. The sentinel check (`"You are an independent reviewer"` / `"Return ONLY the structured output below"`) reads only the top-level param. As a secondary tell, codex ignores your requested output format and replies in its own default style.

**Fix:** move `developer-instructions` out of `config` to the top level of the tool call:
```
mcp__codex__codex({
  prompt: "STAGE: CODE_REVIEW …",
  developer-instructions: "You are an independent reviewer …",   // TOP LEVEL
  sandbox: "danger-full-access",
  cwd: "/workspace/agent/wt-…"
})
```
The codex MCP schema does expose `developer-instructions` as a top-level property (alongside `prompt`, `sandbox`, `cwd`, `config`, `model`, …); `config` is only for CODEX_HOME/config.toml overrides.

Cost when wrong: two full CODE_REVIEW calls (fix #12237, 2026-07-28) produced good critiques that didn't count toward the delivery gate, forcing re-runs. Also keep the reviewer block VERBATIM (the hook diffs the sentinel lines) and remember the gate requires CODE_REVIEW + PLAN_REVIEW + OUTPUT_REVIEW each ≥1 with OUTPUT=approve before `gh pr create` is allowed.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785246644952-codex-critique-developer-instructions-must-be-a-to.md`_
