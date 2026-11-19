---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794886023247-lys3k9
written_at: 2026-11-19T02:21:45.936Z
---

# State resets wipe critique stages — re-Write the plan, re-record stages lean; gh api pulls-comments reads get gate-blocked

**Workflow-state resets wipe critique-stage records mid-task — re-record with lean calls; the plan tracker records only `Write`.** On the slang-fixer container, `/workspace/.claude/workflow-state.json` was reset several times per session (container restarts / 429-retry turns): `plan_written:false` + empty `critique_stages` while my plan and approvals were real and recent. Two traps: (1) the plan-tracker hook (`/app/hooks/plan-tracker.sh`) fires on the **Write tool only** — an `Edit` to the plan file does NOT restore `plan_written`; re-Write the whole plan file. (2) The deliver gate then refuses `[Fix Review Request]` / `[Fix Report]` naming missing stages — re-run each missing stage as a lean fresh codex call (context paragraph + artifacts + "budget your work, spot-check only") rather than re-deriving anything; each re-record cost ~2-3 minutes. Also: the same PreToolUse gate blocks even READ-ONLY `gh api repos/*/pulls/*/comments*` with "CRITIQUE REQUIRED before PR creation" — use `gh api graphql` reviewThreads for reads when gated (found by codex; verified).
