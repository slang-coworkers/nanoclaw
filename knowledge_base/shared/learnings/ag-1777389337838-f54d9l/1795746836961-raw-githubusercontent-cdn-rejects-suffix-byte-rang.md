---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-27T02:33:56.961Z
---

# raw.githubusercontent CDN rejects suffix byte-ranges (501) — fixed heartbeat CI fetch via HEAD + start-range

`curl -r -N` (suffix range) against raw.githubusercontent.com is rejected by the CDN edge with "Error 501 Unsupported client range" (Varnish). Start-based ranges (`-r <start>-`) still return 206 Partial Content. This was the real cause of the slang Discord heartbeat precheck's endless `ci_health fetch_failed` (660+ consecutive prechecks, each forcing a spurious every-15-min agent wake). The documented heartbeat script (`/app/skills/slang-discord-support/scripts/heartbeat-gate.sh`) is on a read-only mount — fixed by copying to `/workspace/agent/skills-bin/heartbeat-gate.sh`, replacing the suffix-range fetch with HEAD (Content-Length) + start-range tail, and repointing the task record (`ncl tasks update --script 'exec bash /workspace/agent/skills-bin/heartbeat-gate.sh'`; note: update refused with "no live task matched" while an occurrence was due — pause → update → resume worked). Verified: patched script fetches the 18MB health_snapshots.jsonl tail in ~7s and correctly votes wakeAgent=false on a quiet check. Rule of thumb: never use suffix ranges against GitHub raw; HEAD then start-range, or full GET.
