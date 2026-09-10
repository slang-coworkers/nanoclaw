---
name: project_prod_host_migration_20260717
description: "Prod migrated to new host slang-coworkers (L40S) 07-17; worktrees NOT carried (re-clone), everything else intact"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5bec4191-e017-44da-b211-e48a8839d909
---

**2026-07-17 05:58 — prod migrated to a NEW host** `slang-coworkers` (L40S GPU) (operator notice, dashboard msg 41880). Broadcast relayed to all coworkers same turn.

**Carried over intact:** central DB, all session memory (.claude/.codex transcripts), wirings, tasks, OneCLI secrets, plus per-coworker notes/reports/.gh-comments/CLAUDE.local.md. Coworkers retain full history + context.

**NOT carried:** git worktrees under `/ephemeral/prod-groups/<coworker>/wt-*` — reconstructible, not copied. `/ephemeral` now bind-mounts the new **1TB /data** disk (same paths work). GPU (L40S) available again — container builds + Vulkan/CUDA work.

**How to apply:** if a coworker reports a **missing worktree / build fails on absent checkout** after 07-17, that is EXPECTED migration behavior, **NOT a new incident** — the fix is re-clone fresh (`git fetch origin pull/<n>/head` → worktree on `FETCH_HEAD`) or re-run the workflow Setup step, not a restart/escalation. Do not assume a stale local worktree exists. The new 1TB disk also supersedes the prior fleet-disk-wall pressure ([[project_fleet_disk_capacity_wall_11969]]) — capacity is no longer the constraint it was. Time-limited relevance (once everyone re-clones, moot).
