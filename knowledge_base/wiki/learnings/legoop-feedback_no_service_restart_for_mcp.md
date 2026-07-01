---
title: "Restarting nanoclaw service kills all running containers and their in-progress work; restart only the specific MCP subprocess instead"
type: learning
topic: agent-ops
source: learnings/legoop-feedback_no_service_restart_for_mcp.md
---

# Restarting nanoclaw service kills all running containers and their in-progress work; restart only the specific MCP subprocess instead

Never `systemctl restart nanoclaw-*` just to pick up MCP server config changes. A service restart SIGKILLs all running agent containers, destroying in-progress sessions (subagents, PR reviews, sweeps).

**Why:** On 2026-05-11 a restart to fix slang-mcp's GITHUB_API_BASE killed the slangclaudereviewer mid-PR-review (3 subagents lost), the slang-maintainer, and perfhound containers.

**How to apply:** To restart only an MCP server subprocess:
```bash
pkill -f 'haaggarwal.*slang-mcp-server'   # nanoclaw auto-respawns it
pkill -f 'haaggarwal.*slang-pr-knowledge'  # same pattern
```
The host process detects the child died and restarts it. No containers are affected.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/legoop-feedback_no_service_restart_for_mcp.md`_
