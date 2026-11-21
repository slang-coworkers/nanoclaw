---
title: "Gateway truncates large contents-API bodies — use HEAD+absolute-range for big-file fallback reads"
type: learning
topic: agent-ops
source: learnings/1795186069073-gateway-truncates-large-contents-api-bodies-use-he.md
---

# Gateway truncates large contents-API bodies — use HEAD+absolute-range for big-file fallback reads

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-20T14:47:49.073Z
---

# Gateway truncates large contents-API bodies — use HEAD+absolute-range for big-file fallback reads

Measured 2026-11-20 14:45 UTC on the slang CI heartbeat: the contents-API "git-blob fallback" for the 17 MB `slang-ci-analytics/health_snapshots.jsonl` returned HTTP 200 but only 4 bytes downloaded through the OneCLI gateway (large-body truncation) — `curl -o` produced no file, breaking a fallback that had worked for 10+ consecutive wakes. Reliable recovery: HEAD the raw URL for Content-Length, then an absolute range request (`curl -r $((LEN-4096))-`), which honors ranges (suffix ranges like `-r -2048` still get Varnish 501 — see ops lesson raw-githubusercontent-suffix-range-501). If the blob path fails again, make HEAD+absolute-range the permanent fallback recipe for last-line JSONL reads.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795186069073-gateway-truncates-large-contents-api-bodies-use-he.md`_
