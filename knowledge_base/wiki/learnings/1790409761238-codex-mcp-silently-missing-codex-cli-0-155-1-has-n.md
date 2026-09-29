---
title: "codex MCP silently missing: codex-cli 0.155.1 has no mcp-server subcommand"
type: learning
topic: agent-ops
source: learnings/1790409761238-codex-mcp-silently-missing-codex-cli-0-155-1-has-n.md
---

# codex MCP silently missing: codex-cli 0.155.1 has no mcp-server subcommand

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790308879556-eaoglv
written_at: 2026-09-26T08:02:41.238Z
---

# codex MCP silently missing: codex-cli 0.155.1 has no mcp-server subcommand

# `mcp__codex__codex` silently missing: codex-cli 0.155.1 has no `mcp-server` subcommand

**Symptom (2026-09-26).** `mcp__codex__codex` returned "No such tool available" in slang-fixer, and it survived a restart. My orchestrator container has the same gap. Every critique gate that needs a *recorded* codex call (codex-critique, critique-overlay, gate-audit `required: mcp__codex__codex`) therefore can't be satisfied. The gate then burns its denial cap and pings an admin.

**Not the cause:** the MCP allow-list. `ncl groups mcp-tools get` shows `inherited`/unrestricted, and `NANOCLAW_MCP_POLICY` has `restrict:false`. Empty `mcp_servers` in the group config is also normal, because codex is a *seeded* server, not a configured one.

**Actual cause.** `/app/src/index.ts` seeds `codex: buildCodexMcpServer(env)`, which spawns `codex -c … mcp-server`. The image ships **codex-cli 0.155.1** (`container/cli-tools.json`; the `/pnpm/codex` shim is dated 2026-09-25 06:10). That version's `codex --help` has no `mcp-server` command; only `mcp` (manage external servers), `exec`, `app-server`, etc. remain. So `mcp-server` is parsed as a PROMPT, codex tries the interactive TUI, and it exits 1 with `Error: stdin is not a terminal`. The SDK drops the dead stdio child without any visible error.

**How to check in 10 seconds:** `codex --help | grep mcp-server` (no output means broken). Or spawn `buildCodexMcpServer(process.env)` from `/app/src/codex-mcp-server.ts` with Bun and send `initialize`: stderr shows `stdin is not a terminal`.

**Fix (operator-owned image change).** Either pin `@openai/codex` in `container/cli-tools.json` back to a version that still has `mcp-server` and rebuild, or port `codex-mcp-server.ts` to the new CLI surface. Meanwhile, `codex exec` still works and can supply non-recorded supporting critique.

**Resolved (confirmed 2026-09-28).** The operator pinned codex back to **codex-cli 0.153.4**, which has `mcp-server`. `codex --help | grep mcp-server` matches again in the orchestrator container, and slang-fixer recorded an `mcp__codex__codex` round. If this breaks again, check `codex --version` against the last known-good 0.153.4 before debugging the allow-list.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790409761238-codex-mcp-silently-missing-codex-cli-0-155-1-has-n.md`_
