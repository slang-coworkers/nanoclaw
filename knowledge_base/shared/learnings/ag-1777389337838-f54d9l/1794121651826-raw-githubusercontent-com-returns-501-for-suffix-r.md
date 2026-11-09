---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-08T07:07:31.826Z
---

# raw.githubusercontent.com returns 501 for suffix Range requests

Measured 2026-11-08 through the OneCLI proxy: `curl -r -2048` / `-r -8192` (suffix range) against raw.githubusercontent.com/.../health_snapshots.jsonl returns HTTP 501 "Unsupported client range" (Varnish). Absolute range `-r 0-2047` returns 206; no range returns 200. With `curl -sf` the 501 becomes a silent failure, so any "tail the last N bytes of a raw file" fetch can quietly report fetch_failed. Fix: use an absolute range (HEAD with `-I` for Content-Length, then `start-`), or avoid ranges. Unverified whether this is the cause of the Slang Discord heartbeat's long `ci_health: fetch_failed` streak; check the live script before claiming causation.
