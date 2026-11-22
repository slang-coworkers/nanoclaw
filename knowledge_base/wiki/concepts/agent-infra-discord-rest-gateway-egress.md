---
title: "Discord REST via the OneCLI gateway: curl-only, headerless, and snowflake thread sorting"
type: concept
group: agent-infra
tags: [discord, onecli, gateway, credentials, curl, urllib, threads, snowflake, heartbeat, egress]
source_count: 4
---

# Discord REST via the OneCLI gateway: curl-only, headerless, and snowflake thread sorting

> Sibling page: [Gateway Credential Outage Playbook](agent-infra-gateway-credential-outage-playbook.md) — the GitHub-side gateway quirks (401 outage ladder, large-body truncation on raw.githubusercontent reads). This page holds the Discord-side egress facts, which point the *opposite* direction per client.

## TL;DR

- **Always use curl (or gh) for Discord REST reads on this host — never python `urllib.request`.** python urllib gets HTTP 403 on every Discord API read while curl to the same URLs returns 200, even with no Authorization header; the gateway's credential injection is client-specific. The 403 looks like a Discord permission regression but is purely a client-side egress difference.
- **Issue Discord REST calls with NO Authorization header.** The OneCLI gateway injects the credential on headerless requests; an explicit (empty/stale) `Authorization: Bot` header can override the injection and fail silently under `curl -sf`.
- The local `memory/.discord-token` file was revoked 2026-08-04 (only a `.revoked-20260804` copy remains) — the gateway is the only credential path, so drop the `$(cat .discord-token)` pattern from sweep scripts entirely.
- The `GET /guilds/{id}/threads/active` payload lacks `thread_metadata.last_message_id` — sort threads by decoding the thread-ID snowflake: `date -u -d @$(( (id >> 22) + 1420070400000 ) / 1000)`.
- During gateway-truncation episodes `threads/active` can return HTTP 200 with a **zero-byte body** (channel-message reads still work) — treat thread sweeps as unreliable then and report "thread sweep partial" rather than claiming "0 new" from a possibly-blind check.

## curl is the only Discord client on this host

Measured on the Slang Discord Support heartbeat (2026-11-22 02:30 UTC): python `urllib.request` returns **HTTP 403 on every Discord API read** (all channels/threads) while `curl` to the same URLs returns 200 — even with no Authorization header at all. The OneCLI gateway injects the Discord credential for curl's proxied requests, but python urllib's requests either bypass the proxy or present credentials the gateway won't accept; since the old `/workspace/agent/memory/.discord-token` was revoked on 2026-08-04 and the gateway is now the only credential path, **always use curl (or gh) for Discord REST reads on this host, never python urllib** [Discord REST on this host: curl only — python urllib 403s (gateway credential injection is client-specific)](../learnings/1795314731136-discord-rest-on-this-host-curl-only-python-urllib-.md). Note the asymmetry with the raw.githubusercontent case on the [gateway playbook](agent-infra-gateway-credential-outage-playbook.md): there curl gets truncated bodies and python urllib returns the complete range — the rule is per-host-per-service, measured, not a general "use client X".

The headerless requirement came first (2026-11-21): Discord REST calls keep working through the gateway *only* when issued with **no** Authorization header — a request carrying an explicit (empty/stale) `Authorization: Bot` header can override or break the gateway's credential injection and fail silently under `curl -sf`. Since `memory/.discord-token` no longer exists (only the `.revoked-20260804` copy), drop the `$(cat .discord-token)` pattern from sweep scripts entirely and let the gateway inject [Container quirks: /tmp/opencode unwritable; Discord REST via gateway needs NO auth header](../learnings/1795273578813-container-quirks-tmp-opencode-unwritable-discord-r.md).

## Reading threads: snowflake sorting and blind-sweep honesty

`GET /guilds/{id}/threads/active` does not return `thread_metadata.last_message_id`, so "sort by last activity" needs the thread-ID snowflake instead: `date -u -d @$(( (id >> 22) + 1420070400000 ) / 1000)` gives the creation time to order by [Fastly rejects Range requests on raw.githubusercontent.com — breaks heartbeat precheck CI fetch](../learnings/1795224008854-fastly-rejects-range-requests-on-raw-githubusercon.md). And during gateway-truncation episodes (2026-11-22 00:30 UTC) the same `threads/active` path returned HTTP 200 with a **zero-byte body** via curl — Discord-side headers healthy, auth accepted, channel-message reads via the same path pattern still working. When a thread sweep reads empty in such an episode, do not report "0 new threads" from the possibly-blind check; report "thread sweep partial" and re-check later [Gateway truncates curl bodies from raw.githubusercontent — python urllib bypass verified](../learnings/1795307593189-gateway-truncates-curl-bodies-from-raw-githubuserc.md).

**Source learnings (4):**
- [Discord REST on this host: curl only — python urllib 403s (gateway credential injection is client-specific)](../learnings/1795314731136-discord-rest-on-this-host-curl-only-python-urllib-.md) — .discord-token revoked 2026-08-04; gateway is the only credential path
- [Container quirks: /tmp/opencode unwritable; Discord REST via gateway needs NO auth header](../learnings/1795273578813-container-quirks-tmp-opencode-unwritable-discord-r.md) — headerless requests get gateway injection; explicit Authorization headers break it
- [Fastly rejects Range requests on raw.githubusercontent.com — breaks heartbeat precheck CI fetch](../learnings/1795224008854-fastly-rejects-range-requests-on-raw-githubusercon.md) — (Discord half) threads/active lacks `thread_metadata.last_message_id`; sort by snowflake decode
- [Gateway truncates curl bodies from raw.githubusercontent — python urllib bypass verified](../learnings/1795307593189-gateway-truncates-curl-bodies-from-raw-githubuserc.md) — (Discord half) threads/active returned 200 with a zero-byte body; report "thread sweep partial", not "0 new"

_Catalog: [[wiki/index.md]]_
