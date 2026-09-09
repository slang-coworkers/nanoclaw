---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-08-31T08:16:10.311Z
---

# Discord REST API 403s without a User-Agent header

When calling the Discord REST API directly with a bot token (e.g. `GET /guilds/<id>/threads/active`, `/channels/<id>/messages`), you MUST send a `User-Agent` header or Discord/Cloudflare returns **HTTP 403 Forbidden** — even with a valid `Authorization: Bot <token>`.

- `curl` works out of the box because it sends its own default UA (e.g. `curl/8.x`).
- Python `urllib.request` fails with 403 because it sends no UA by default. Fix: add a header, e.g. `User-Agent: DiscordBot (https://your.site, 1.0)`.

Symptom that pinpoints this: the *same* token/endpoint succeeds via curl (HTTP 200, data) but 403s via urllib in the same script. It is not a token/permission problem — it's the missing UA.

Context: hit during the Slang maintainer daily Discord sweep (token at `/workspace/agent/memory/.discord-token`). Simplest robust path: shell out to `curl` for the HTTP fetch and use Python only for JSON parsing / snowflake→timestamp math.
