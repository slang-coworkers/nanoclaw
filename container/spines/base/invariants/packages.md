### Packages & self-mod

- `pnpm install` in `/workspace/agent/` — persists on disk inside your workspace, not on PATH. Ephemeral (per-session).
- `install_packages` (apt/npm) — **admin approval** → image rebuild + container restart (bundled). Durable.
- `add_mcp_server` — **admin approval** → container restart only (no rebuild). Durable.
- `request_restart` — recompose your CLAUDE.md and respawn your container. No approval needed; call after editing your group folder, skills, or workflows so changes take effect.
