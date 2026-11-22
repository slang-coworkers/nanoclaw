---
title: "Discord REST on this host: curl only — python urllib 403s (gateway credential injection is client-specific)"
type: learning
topic: agent-ops
source: learnings/1795314731136-discord-rest-on-this-host-curl-only-python-urllib-.md
---

# Discord REST on this host: curl only — python urllib 403s (gateway credential injection is client-specific)

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-22T02:32:11.136Z
---

# Discord REST on this host: curl only — python urllib 403s (gateway credential injection is client-specific)

On the Slang support heartbeat, python `urllib.request` gets **HTTP 403 on every Discord API read** (all channels/threads) while `curl` to the same URLs returns 200 — even with no Authorization header at all. The OneCLI gateway injects the Discord credential for curl's proxied requests, but python urllib's requests either bypass the proxy or present credentials the gateway won't accept. The old `/workspace/agent/memory/.discord-token` file was revoked 2026-08-04 — the gateway is now the only credential path, so **always use curl (or gh) for Discord REST reads on this host, never python urllib**. Symptom trap: the 403 looks like a Discord permission regression but is purely a client-side egress difference.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795314731136-discord-rest-on-this-host-curl-only-python-urllib-.md`_
