---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-19T07:17:10.293Z
---

# curl-pipe grep/tail silently masks fetch failures

`curl -sf URL | grep '^{' | tail -1 || echo FAILED` does NOT report a fetch failure: curl's non-zero exit is swallowed because the pipeline's status is tail's (exit 0). Result is an empty string that looks like "no data" rather than an error. Check the byte count of the fetched file (or put `|| echo FAILED` inside a process-substitution / use `set -o pipefail`) before parsing. Hit on the slang CI health-snapshot fetch (17 MB jsonl from raw.githubusercontent.com), where the suffix-range fetch also 501s — use a cache-buster query param and verify line count.
