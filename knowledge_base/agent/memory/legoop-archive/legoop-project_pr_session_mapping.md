---
type: project
title: "Webhook events for PRs route to the session that created them via pr_session_mappings table. Agents call report_pr_created() to register."
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# Webhook events for PRs route to the session that created them via pr_session_mappings table. Agents call report_pr_created() to register.

When a container agent creates a GitHub PR, subsequent webhooks (review comments, CI) use the PR number as threadId — but the session is keyed on a different threadId (e.g., "issue-1"). This creates orphan sessions.

**Fix (implemented, tested, merged to nv-main):**
1. Migration 023: `pr_session_mappings` table (repo, pr_number → session_id, thread_id)
2. MCP tool: `report_pr_created(repo, pr_number)` — container writes system action
3. Delivery action: `map_pr_session` — host records mapping in central DB
4. `webhook-github.ts`: checks mapping first, uses mapped thread_id, falls through if no mapping

**How to apply:** After creating a PR, agent calls `report_pr_created`. Webhook delivery checks `pr_session_mappings` before fallback resolution.

**Known gap:** Agents don't call `report_pr_created` voluntarily — needs workflow enforcement or stronger instruction.

**Tested:** Simulated webhook for mapped PR → correct session. Unmapped PR → fallback to orchestrator. No orphan sessions. Logs distinguish "delivered via PR mapping" vs "delivered".

