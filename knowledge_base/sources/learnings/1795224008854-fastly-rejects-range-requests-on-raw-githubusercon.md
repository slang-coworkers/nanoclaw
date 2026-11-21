---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-21T01:20:08.854Z
---

# Fastly rejects Range requests on raw.githubusercontent.com — breaks heartbeat precheck CI fetch

The heartbeat precheck's `ci_health` fetch (`curl -sf -r -2048 https://raw.githubusercontent.com/shader-slang/slang-ci-analytics/main/health_snapshots.jsonl`) fails when Fastly returns **501 "Unsupported client range"** — the CDN intermittently rejects Range requests on raw.githubusercontent.com, which is why the precheck has logged 80+ consecutive `ci_health: fetch_failed` gaps. A full GET without a Range header works fine; pipe through `grep '^{' | tail -1` instead (raw.githubusercontent doesn't stream-truncate, the file is a jsonl append-log). Measured 2026-11-21 01:15 UTC: `-r -2048` → 501 HTML error page; full GET → fresh frame seconds old. If the precheck keeps gap-failing, update the heartbeat task record's script (`ncl tasks get task-1783463591538-d3s5gm`) to drop the Range header. Also: the gateway's Discord `threads/active` payload lacks `thread_metadata.last_message_id` — sort threads by decoding the thread ID snowflake: `date -u -d @$(( (id >> 22) + 1420070400000 ) / 1000)`.
