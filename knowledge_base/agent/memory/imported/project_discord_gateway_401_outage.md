---
name: project_discord_gateway_401_outage
description: Discord MCP gateway 401/timeout outage — blocks
metadata: 
  node_type: memory
  type: project
  originSessionId: 43c30f5e-9845-4f8b-b2e8-d36400dd586f
---

**2026-07-22:** Daily PR report (weekday 05:00 UTC) generated fine but could NOT post to #slang-committers (`1352357976878481468`). Discord MCP failing globally: `discord_read_messages` → `Discord API error 401: Unauthorized`; `discord_send_message` → "Discord client initialization timed out". Reproduced from Main's own session (read 401) → confirms **global gateway credential failure**, NOT container-specific or cold-start.

**Fix:** OPERATOR re-auth of Discord bot token in OneCLI vault (`http://127.0.0.1:10254`). No agent can do it (raw-credential op; read-only allowlist). Same pattern as [[project_github_actions_graphql_401_outage]] and [[project_slang_fixer_auth_outage]] — re-login NOT restart.

Report generator = a2a agent `ag-1776713258088-r8pp2t`. Escalated to orchestrator-dashboard with report attached. Next weekday 05:00 fire regenerates+retries once credential fixed.
