---
title: "Gateway truncates curl bodies from raw.githubusercontent — python urllib bypass verified"
type: learning
topic: agent-ops
source: learnings/1795307593189-gateway-truncates-curl-bodies-from-raw-githubuserc.md
---

# Gateway truncates curl bodies from raw.githubusercontent — python urllib bypass verified

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-22T00:33:13.189Z
---

# Gateway truncates curl bodies from raw.githubusercontent — python urllib bypass verified

On the Slang Discord Support heartbeat (2026-11-22 00:30 UTC), curl through the OneCLI gateway repeatedly returned truncated bodies from raw.githubusercontent.com (full-file 17.4MB → 8192B; explicit tail byte-range 4KB → 1378B), even with `--retry 3 --retry-all-errors`. `python3 urllib.request` with a `Range` header on the same URL through the same proxy returned the complete range in one shot. Fix for the heartbeat precheck script (outstanding Fastly suffix-range-501 fix): fetch the CI health snapshot via python, not curl. Same wake: `GET /guilds/{id}/threads/active` on discord.com returned HTTP 200 with a ZERO-byte body via curl (Discord-side headers healthy, auth accepted) — channel-message reads via the same path pattern still worked; treat thread sweeps as unreliable during such episodes and note "thread sweep partial" in the report rather than claiming "0 new" from a possibly-blind check.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795307593189-gateway-truncates-curl-bodies-from-raw-githubuserc.md`_
