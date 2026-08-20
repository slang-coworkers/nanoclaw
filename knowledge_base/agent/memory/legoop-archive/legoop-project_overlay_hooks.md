---
type: project
title: "legoop-project_overlay_hooks.md"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

## Overlay Enforcement (PR #25 on nv-main)

PR: https://github.com/slang-coworkers/nanoclaw/pull/25
Branch: fix/overlay-hooks (cherry-picked from nv-coworkers)
All files belong to nv-main bucket.

### Architecture
- plan-overlay: forces plan before code edits (implement only)
- critique-overlay: forces codex-critique review after deliverables (all 4 workflows)
- Hooks injected by container-runner.ts into container settings.json at spawn time
- Hook scripts at container/hooks/*.sh, bind-mounted read-only at /app/hooks

### Key hooks
- plan-gate.sh (PreToolUse Edit|Write|Bash) — blocks without plan, blocks when plan stale (15 edits), blocks when critique overdue (3 edits)
- edit-counter.sh (PostToolUse Edit|Write|Bash) — counts edits, sets critique_required/plan_stale
- critique-tracker.sh (SubagentStart) — counts critique rounds, clears critique_required
- plan-tracker.sh (PostToolUse Write) — detects plan writes, clears plan_stale
- workflow-state-reset.sh (UserPromptSubmit) — resets on new routed tasks
- intent-router.sh (UserPromptSubmit) — LLM (Haiku) classifies intent → recommends workflow

### Thresholds (configurable via env)
- CRITIQUE_EDIT_LIMIT=3 (review every 3 edits)
- PLAN_EDIT_LIMIT=15 (refresh plan every 15 edits)

### Remaining gaps
- Agent still doesn't always invoke the workflow Skill (hooks enforce plan+critique but agent bypasses the structured step list)
- No commit check at end of turn
- Untyped coworkers (global/main) have no enforcement (by design)

**Why:** Agents were bypassing plan and critique gates by going straight to Edit/Write without entering workflow Skills. Hooks now enforce the discipline at the harness level.
**How to apply:** Changes take effect on next container spawn after `pnpm run build` + service restart. No container image rebuild needed.

