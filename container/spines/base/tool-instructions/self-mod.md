## Self-modification (`install_packages`, `add_mcp_server`)

Both tools require admin approval. Anyone can request; the admin sees an approval card.

### `install_packages` — add apt/npm packages

```
install_packages({ apt: ["ffmpeg"], npm: ["@xenova/transformers"], reason: "Audio transcription" })
```

Approval triggers an image rebuild + container restart (bundled). Persists for all future turns.

**vs workspace `pnpm install`:**
- `pnpm install` in `/workspace/agent/` — temporary, gone after this turn.
- `install_packages` — durable. Use when the user asks for a capability that should stick.

### `add_mcp_server` — register an MCP server

```
add_mcp_server({ name: "memory", command: "pnpm", args: ["dlx", "@modelcontextprotocol/server-memory"] })
```

Approval triggers a container restart (no rebuild — bun loads the MCP config directly). Browse servers at https://mcp.so.

**Credentials**: don't ask the user for them. Pass a placeholder string and tell the user to add the real credential to the OneCLI agent vault. A test request before the secret lands triggers a vault dashboard URL in the response — give that URL to the user.
