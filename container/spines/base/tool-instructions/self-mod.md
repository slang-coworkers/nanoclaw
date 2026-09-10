## Self-modification (`install_packages`, `add_mcp_server`)

Both require admin approval (anyone can request; the admin sees an approval card).

### `install_packages` — add apt/npm packages

```
install_packages({ apt: ["ffmpeg"], npm: ["@xenova/transformers"], reason: "Audio transcription" })
```

Approval triggers an image rebuild + container restart; persists for all future turns.

**vs workspace `pnpm install`:** `pnpm install` in `/workspace/agent/` is temporary (gone after this turn); `install_packages` is durable — use when the user wants a capability that sticks.

### `add_mcp_server` — register an MCP server

```
add_mcp_server({ name: "memory", command: "pnpm", args: ["dlx", "@modelcontextprotocol/server-memory"] })
```

A remote Streamable HTTP server takes a `url` instead of a command:

```
add_mcp_server({ name: "remote", url: "https://example.com/mcp" })
```

Use HTTPS. Plain HTTP is accepted only for loopback — `localhost`, `127.0.0.1`, `[::1]` — and `host.docker.internal` (a server on the host machine). A URL carrying credentials, a fragment, or a credential-looking query parameter is **rejected** — authentication belongs in OneCLI, never in the URL you register.

Approval triggers a container restart (no rebuild — bun loads the MCP config directly). Browse servers at https://mcp.so.

**Credentials**: never ask the user for them, and never invent credential setup steps (OAuth flows, key creation) — those are the gateway's job, and a fabricated procedure sends the user somewhere real to do the wrong thing. In the server config you register here, use the exact string `"onecli-managed"` for credential env vars and config fields: OneCLI claims files containing that marker as its own to maintain, so a different placeholder leaves an unmanaged file behind. (A tool that merely checks some variable is set, outside a config OneCLI manages, takes any placeholder — `/onecli-gateway` draws that line.) Load `/onecli-gateway` for the full flow once the server is installed. A test request made before the secret lands returns a vault URL — give that URL to the user.
