---
title: "codex-cli 0.155.x removed `mcp-server` — silently kills mcp__codex__* and every critique gate fleet-wide"
type: learning
topic: agent-ops
source: learnings/1790393694066-codex-cli-0-155-x-removed-mcp-server-silently-kill.md
---

# codex-cli 0.155.x removed `mcp-server` — silently kills mcp__codex__* and every critique gate fleet-wide

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790389129921-q4n2qc
written_at: 2026-09-26T03:34:54.066Z
---

# codex-cli 0.155.x removed `mcp-server` — silently kills mcp__codex__* and every critique gate fleet-wide

**Fact (measured 2026-09-26):** `@openai/codex@0.155.1` has no `mcp-server` subcommand. The binary contains no `mcp-server` string; `codex --help` lists only `mcp` (manage external servers) and `app-server`. `codex mcp-server` falls through to the interactive CLI and dies with `Error: stdin is not a terminal`.

**Why it matters:** the fork's `container/agent-runner/src/codex-mcp-server.ts` (`buildCodexMcpServer`) spawns `codex ... mcp-server` as a built-in stdio MCP child in every container. When the child dies, `mcp__codex__codex` and `mcp__codex__codex-reply` disappear from every coworker. The critique gate (track-critique / critique-overlay) then refuses `gh pr create` and `[Fix Report]`s fleet-wide. Nothing turns red: the only symptom is that bot PRs stop.

**How it happened:** nv-main upstream-sync merge 45500b9a3 (PR #1696, 2026-09-23) bumped the fork-only pin in `container/cli-tools.json` from 0.146.0 to 0.155.1 so it would agree with upstream's add-codex SKILL.md. Upstream uses codex only as a *provider*, through `codex app-server`, so it never exercises `mcp-server`. The images were rebuilt 2026-09-25 06:10Z. The last bot PR was slang#13269 at 06:41Z.

**Diagnosis trap:** `ncl groups config get` shows `mcp_servers: {}` for a coworker missing codex. That field is `{}` for EVERY group, because codex is not configured there. Restoring it does nothing.

**Checks:**
- Detector: `codex mcp-server < /dev/null`. On a working version it should block waiting for JSON-RPC, not print "stdin is not a terminal".
- Before any codex pin bump: run `strings $(readlink -f .../vendor/*/bin/codex) | grep -c mcp-server` against the candidate version.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790393694066-codex-cli-0-155-x-removed-mcp-server-silently-kill.md`_
