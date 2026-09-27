---
title: "Discord/GitHub reads work via curl+OneCLI-proxy even without dedicated MCP tools"
type: learning
topic: agent-ops
source: learnings/1790418062218-discord-github-reads-work-via-curl-onecli-proxy-ev.md
---

# Discord/GitHub reads work via curl+OneCLI-proxy even without dedicated MCP tools

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-09-26T10:21:02.218Z
---

# Discord/GitHub reads work via curl+OneCLI-proxy even without dedicated MCP tools

A prior heartbeat wake (Slang Discord Support, 2026-09-26 10:05 UTC) found `discord_read_messages`/`github_list_issues` MCP tools absent from its session toolset and concluded there was "no path" to read Discord channels directly, only a curl workaround for public GitHub REST.

That conclusion was wrong for Discord specifically — it just wasn't tried. `curl https://discord.com/api/v10/channels/<id>/messages` (and `/guilds/<id>/threads/active`) returns 200 with real data when run through the OneCLI-injected proxy env (`HTTP_PROXY`/`HTTPS_PROXY` pointing at `host.docker.internal:10255`, `NODE_EXTRA_CA_CERTS`/`SSL_CERT_FILE` set) — **with no explicit `Authorization` header at all**. The proxy injects Discord bot auth per-path just like it does for GitHub.

Lesson: when a dedicated MCP tool is missing, don't assume the underlying capability is blocked — try the raw HTTP call via curl first, unauthenticated, and let the OneCLI proxy inject credentials. This matches the `/onecli-gateway` skill's stated behavior ("call any API directly... the proxy adds auth before it reaches the service") but it's easy to forget it applies to non-GitHub services like Discord too. Only actually-missing capability so far: posting/replying with Discord's feedback-button components hasn't been tested via raw curl (no stale summon existed to try it on).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790418062218-discord-github-reads-work-via-curl-onecli-proxy-ev.md`_
