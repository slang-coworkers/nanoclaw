---
type: reference
title: Self-modification — packages & MCP servers
description: install_packages vs temporary pnpm install; add_mcp_server and the OneCLI vault credential-placeholder flow.
---

# Self-modification: packages & MCP servers

Both require admin approval (anyone requests; the admin sees an approval card).

## `install_packages` — durable apt/npm packages

```
install_packages({ apt: ["ffmpeg"], npm: ["@xenova/transformers"], reason: "Audio transcription" })
```

Approval triggers an image rebuild + container restart; persists for all future
turns.

**vs workspace `pnpm install`:** a `pnpm install` in `/workspace/agent/` is
temporary (gone after this turn); `install_packages` is durable. Use the durable
form when the user wants a capability that sticks.

## `add_mcp_server` — register an MCP server

```
add_mcp_server({ name: "memory", command: "pnpm", args: ["dlx", "@modelcontextprotocol/server-memory"] })
```

Approval triggers a container restart (no rebuild — bun loads the MCP config
directly). Browse servers at https://mcp.so.

**Credentials:** never ask the user for raw credentials. Pass a placeholder
string and tell the user to add the real credential to the OneCLI agent vault. A
test request made before the secret lands returns the vault dashboard URL — give
that URL to the user.

Related: [[orchestrator/agent-spawning.md]], [[orchestrator/mounts.md]].
