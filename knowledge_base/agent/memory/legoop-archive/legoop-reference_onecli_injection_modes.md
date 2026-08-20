---
type: reference
title: "OneCLI does HTTP-header injection ONLY — not env-var, no secret-reveal"
description: "ported lego-operator-memory archive; reference note"
tags: [legoop-archive, ported]
---

# OneCLI does HTTP-header injection ONLY — not env-var, no secret-reveal

OneCLI (prod gateway `http://172.17.0.1:10254`, proxy on `:10255`) is a TLS-layer header injector, not a general secret vault:

- `secrets create` takes `--header-name` + `--value-format` → injects an HTTP header on outbound HTTPS matching `--host-pattern` / `--path-pattern`. E.g. "Discord Bot" injects `Authorization: Bot {value}` for `discord.com`; GitHub secrets inject `Authorization: token {value}` for `api.github.com`; CODEX injects `Authorization: Bearer {value}` for `inference-api.nvidia.com/v1/responses*`.
- **No env-var injection.** Declaring a var in OneCLI does NOT put it in a process env. (This is exactly why container Discord tools rely on the wire-injection path, not `DISCORD_BOT_TOKEN` — see the discord-no-proxy gotcha.)
- **No `secrets reveal` / `get-value`.** Values are write-only; you can only manage metadata.
- `onecli run -- <cmd>` injects CA-cert + proxy env vars only, never arbitrary secret values.

**The misleading `.env-vars` manifest:** `container/mcp-servers/slang-mcp/.env-vars` is a NanoClaw-side manifest of *which keys* slang-mcp needs; NanoClaw reads those keys from the project root `.env` and passes them to the MCP child process. Source of truth = `.env`, not the OneCLI vault.
