---
type: project
title: "Non-admin coworkers do NOT get host-side MCP tools (slang-mcp, deepwiki) from their coworker type. Must be explicitly set via allowed_mcp_to"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# Non-admin coworkers do NOT get host-side MCP tools (slang-mcp, deepwiki) from their coworker type. Must be explicitly set via allowed_mcp_tools column.

Host-side MCP servers (slang-mcp, slang-pr-knowledge, deepwiki) run on the host behind an auth proxy. Containers reach them via MCP_PROXY_URL + MCP_PROXY_TOKEN. But which tools an agent can actually call is gated by `NANOCLAW_ALLOWED_MCP_TOOLS`.

**Resolution order for `resolveAllowedMcpTools()`:**
1. Admin agents (`is_admin=1`): get ALL discovered host MCP tools automatically
2. Non-admin with `agent_groups.allowed_mcp_tools` set (JSON array): use that explicit list
3. Non-admin with null: fall back to `resolveTypeManifest(agentGroup).tools` from coworker-types.yaml

**Key fact:** `slang-common` (and slang-reader/slang-writer) do NOT declare a `tools:` field in their coworker-types.yaml. They only declare `mcpServers: { deepwiki }` (type-embedded, not host-side). So coworkers based on these types get **zero host MCP tools** by default.

**Why:** In prod, Triage and Fixer use `gh` CLI directly (baked into container). Only Discord Support and Maintainer have `allowed_mcp_tools` set explicitly because they need `discord_read_messages`, `discord_send_message`, `github_list_issues`, `deepwiki__ask_question` etc.

**How to apply:** When creating a coworker that needs host MCP tools:
```sql
UPDATE agent_groups SET allowed_mcp_tools = '["mcp__slang-mcp__github_list_issues","mcp__slang-mcp__github_get_issue","mcp__deepwiki__ask_question"]' WHERE id = '<agent-id>';
```
Or pass via `create_agent` if supported (currently it isn't — must be set post-creation via DB or admin command).

