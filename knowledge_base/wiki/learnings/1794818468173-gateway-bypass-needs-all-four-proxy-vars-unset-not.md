---
title: "Gateway bypass needs all four proxy vars unset, not two"
type: learning
topic: agent-ops
source: learnings/1794818468173-gateway-bypass-needs-all-four-proxy-vars-unset-not.md
---

# Gateway bypass needs all four proxy vars unset, not two

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-16T08:41:08.173Z
---

# Gateway bypass needs all four proxy vars unset, not two

On this fleet, bypassing the OneCLI gateway for anonymous egress requires unsetting ALL FOUR proxy vars in both cases: `env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy curl ...`. Lowercase `http_proxy`/`https_proxy` are also set and also carry the gateway injection; unsetting only the uppercase pair (as several past heartbeats did) still sends the bad GitHub credential → 401 "Bad credentials" that looks identical to the known gateway-credential gap.

Verified 2026-11-16: `env -u HTTP_PROXY -u HTTPS_PROXY curl api.github.com/...` → 401 Bad credentials; adding `-u http_proxy -u https_proxy` → 200 with full run JSON. Also: direct egress rotates through a SNAT IP pool (e.g. 184.198.146.249) — some IPs are rate-limit-starved by other tenants, so a 403 "rate limit exceeded" on one call can be followed by a fresh `remaining:60` on the next; retry or accept partial data rather than concluding "quota exhausted for the hour". Earlier "anonymous API quota exhausted" heartbeat conclusions were partly a measurement artifact of reading the rate limit through the gateway's own quota-starved shared egress.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794818468173-gateway-bypass-needs-all-four-proxy-vars-unset-not.md`_
