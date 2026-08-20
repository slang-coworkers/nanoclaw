---
type: project
title: "How NanoClaw's MCP server supervision works after PRs"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# How NanoClaw's MCP server supervision works after PRs

NanoClaw runs each Python MCP server (slang-mcp, slang-pr-knowledge) under a `supergateway` Node process that bridges stdio↔HTTP for the agent containers. The full process tree is:

```
nanoclaw (Node, systemd-supervised)
  └── supergateway (Node, --stdio uv run … <server>)
       └── /bin/sh -c "uv run …"             (one per active MCP session)
            └── uv run …
                 └── python <server>           ← the actual MCP server
```

**Leak dynamics — historical and current:**

| Era | Mode | Leak rate observed |
|---|---|---|
| Pre-PR #309 (May 13) | stateless → 1 child PER REQUEST | 944 orphans on jkiviluoto, 111 on prod |
| PR #309 → PR #352 (May 13–15) | --stateful → 1 child PER SESSION; no idle reap | ~38 on prod over 28h |
| Post-PR #352 (May 15) | --stateful + --sessionTimeout=600000 + reapProcessTree | bounded — ~N+tail where N = active container count, tail decays in 10 min |

**The trigger:** every NanoClaw container that connects to slang-mcp via the auth proxy creates one HTTP MCP session, and supergateway forks a new stdio child for that session. Every container respawn (`request_restart`, `claude-md-stale`, `absolute-ceiling`, heartbeat timeout, host-sweep — see [[feedback-service-restart-kills-containers]]) creates a new session → new orphan, because the prior session is never gracefully closed.

**The three defenses (all in `src/mcp-registry.ts` after PR #352):**

1. `--stateful` (PR #309) — one child per session instead of per request. Massive reduction in churn.
2. `--sessionTimeout=600000` ms (10 min, override via `MCP_SESSION_TIMEOUT_MS`) — supergateway internally reaps sessions after that idle. Idle = no MCP traffic; long-running tool calls keep the session active. After a container dies abruptly, its session is "idle" and gets reaped within 10 min.
3. `reapProcessTree(rootPid)` — walks descendants via `pgrep -P` recursively, SIGKILLs all. Called from `stopServer`, the `stop()` returned by `startMcpServers`, and both `proc.on('exit', ...)` handlers. Cleans up any straggler tree on shutdown — including all the historical orphans on the next service restart.

**Steady-state child count expectation:**
- 1 baseline child (supergateway's initial stdio child, alive while supergateway is up)
- + 1 per currently-active MCP session (one per running agent container that's used slang-mcp)
- + decay tail (sessions whose container died within last 10 min, not yet reaped)

For a typical lego: 1–3 children. For prod with 6+ active agent groups: 6–12 children. Anything >20 = something's wrong, likely an infinite container respawn loop.

**Why:** Discovered in real time on 2026-05-15 when prod posted 3 duplicate "Get Bot Help" buttons in https://discord.com/channels/1303735196696445038/1504828967616516176. Investigation found 38+ orphan supergateway children, each holding an independent Discord Gateway WebSocket — three of them happened to be Gateway-connected and fired `on_thread_create` simultaneously. Combined with PR #347 ([[project-lego-discord-readonly]]) + PR #351 (`DISCORD_POST_SUMMON` default off), this is now bounded.

**How to apply:**
- Sanity-check after a long uptime: `ps --ppid <supergw-pid> --no-headers | wc -l`. Compare to active-container count. If wildly higher, look for what's killing containers without graceful shutdown.
- Tune `MCP_SESSION_TIMEOUT_MS` per install if the default 10 min is wrong: shorter for installs with frequent restarts, longer if you have legitimate >10-min idle tool calls (e.g. waiting on slow upstream API).
- Don't put inline `# comments` on the `MCP_SESSION_TIMEOUT_MS=` line in `.env` — see [[feedback-env-no-inline-comments]] for why.
- For env changes to MCP servers: `pkill -f 'lego-nanoclaw.*slang-mcp-server'` won't pick up new env (supergateway's env is fixed at its startup). Either restart the full service (now safe — `reapProcessTree` cleans up) or POST `/servers/restart` to the MCP auth proxy. The old [[feedback-no-service-restart-for-mcp]] guidance was for non-env code reloads; for env changes, full service restart is now the correct path.

