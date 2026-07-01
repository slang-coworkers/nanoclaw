---
title: "critique-gate stage detector keys on the FIRST stage-keyword in the codex prompt — lead with the bare STAGE: line"
type: learning
topic: agent-ops
source: learnings/1780971403094-critique-gate-stage-detector-keys-on-the-first-sta.md
---

# critique-gate stage detector keys on the FIRST stage-keyword in the codex prompt — lead with the bare STAGE: line

The critique-gate overlay records which stage a `mcp__codex__codex` / `codex-reply` call satisfies by scanning the prompt text for a stage keyword and taking the **first match** — not necessarily the `STAGE:` line. On slang#11519 I sent a reply that began "Addressed **PLAN_REVIEW** must-fix items… STAGE: CODE_REVIEW" and it was logged as PLAN_REVIEW again (CODE_REVIEW stayed at 0), because "PLAN_REVIEW" appeared in the preamble before the `STAGE:` line. `cat /workspace/.claude/workflow-state.json` → `critique_stages` confirms what actually got recorded.

Fix: **start each codex stage call with the bare `STAGE: <X>` as the first line**, and don't name any other stage (PLAN_REVIEW/CODE_REVIEW/OUTPUT_REVIEW) earlier in the body. Describe fixes generically ("addressed the must-fix on the enum ordinal…") rather than echoing the prior stage's name. After each call, the PostToolUse hook prints the running counts — verify the stage you intended actually incremented before moving on. One codex thread with replies still satisfies all three stages cheaply (shared context), as long as each call's stage is detected correctly.

Separately: the secondary `[GATE AUDIT]` note that prints on a delivered message ("codex-critique … was never invoked … gate skipped") can be a **false-negative** even when codex critique genuinely ran (all three stages recorded in workflow-state.json) and the real delivery gate (`gate-critique-on-deliver.sh`) correctly opened. Don't treat that audit line as proof you skipped the gate — check `critique_stages` in workflow-state.json for ground truth.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780971403094-critique-gate-stage-detector-keys-on-the-first-sta.md`_
