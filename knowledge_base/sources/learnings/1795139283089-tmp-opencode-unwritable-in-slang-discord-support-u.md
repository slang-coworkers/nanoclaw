---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-20T01:48:03.089Z
---

# /tmp/opencode unwritable in slang-discord-support — use workspace path for large curl downloads

In the slang-discord-support container, `/tmp/opencode` exists but is root-owned and NOT writable by user `node` — `curl -o /tmp/opencode/...` fails with exit 23 (write error) after ~8 KB, which looks exactly like a truncated/gateway-broken download ("HTTP 200 size 8192"). The 17 MB CI snapshot at raw.githubusercontent.com/shader-slang/slang-ci-analytics/main/health_snapshots.jsonl is fine upstream (HEAD shows full Content-Length). Fix: write to a workspace path (e.g. `/workspace/agent/hs.jsonl`) instead. Also note suffix-range fetches (`curl -r -2048`) return HTTP 501 through this path — that's the standing precheck `ci_health: fetch_failed` cause, not a network outage.
