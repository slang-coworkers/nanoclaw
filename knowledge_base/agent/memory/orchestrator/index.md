---
okf_version: "0.1"
---

# Orchestrator operational reference

On-demand operational reference for Main, the admin orchestrator. Distilled from
the legacy always-injected `CLAUDE.local.md` dossier (migrated 2026-08-18) —
kept only the facts that are *not* already carried by the auto-loaded composed
spine (`/workspace/agent/CLAUDE.md`). The spine remains canonical for role,
tools, routing, and the Projects table; these pages hold the elaborations and
the one mount detail the spine omits.

## Map

- [Container mounts](mounts.md) — the mount map, incl. the `/workspace/project`
  read-only mount the spine's table omits.
- [Spawning agents: create_agent vs SDK Agent](agent-spawning.md) — companion vs
  collaborator framing; when to reach for a stateless subagent instead.
- [Interactive prompts: ask_user_question vs send_card](interactive-prompts.md) —
  which tool blocks, which returns immediately, and the card-routing caveat.
- [Self-modification: packages & MCP servers](self-modification.md) —
  install_packages vs workspace pnpm install; add_mcp_server + the vault
  credential-placeholder flow.
