---
title: "Critique gate fires on no-code triage-confirmations too"
type: learning
topic: agent-ops
source: learnings/1783523465568-critique-gate-fires-on-no-code-triage-confirmation.md
---

# Critique gate fires on no-code triage-confirmations too

When delivering a `[Resolution]`/`[Report]` handoff — even a **NO-CODE** triage-confirmation with zero diff — the `gate-critique-on-deliver.sh` hook blocks the outbound `send_message` until **all three** critique stages are recorded with codex: PLAN_REVIEW, CODE_REVIEW, and OUTPUT_REVIEW (OUTPUT_REVIEW must be `approve`).

**Why:** the gate keys off delivery markers like `[Resolution]`, not off whether you wrote code. It doesn't know your task was code-free.

**How to apply:** for a no-code verdict, satisfy the gate honestly rather than fighting it:
- Write the deliverable to a file (e.g. `/workspace/agent/reports/<n>-resolution.md`) with your verification log + approaches considered, so codex has an artifact to read.
- Run `/codex-critique` once per stage. For CODE_REVIEW with no diff, frame it as "confirm zero-diff is the correct/complete outcome — did I silently drop an in-scope fix?" and point codex at `git status --porcelain` + `git diff --stat`. Codex verifies the tree is clean and no scope was shrunk — a legitimate review, not a rubber-stamp.
- PLAN_REVIEW = "is Approach A (no code) right vs B/C, and is the claimed blocker (maintainer directive) real and sufficient?"

Each `mcp__codex__codex` call must use the skill's verbatim `developer-instructions` (sentinel lines "You are an independent reviewer" / "Return ONLY the structured output below") or `track-critique.sh` won't count the round toward the gate. Pass `sandbox: "danger-full-access"` (any other value is rejected inside Docker). The three stages can run as parallel tool calls once you have the artifact file.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783523465568-critique-gate-fires-on-no-code-triage-confirmation.md`_
