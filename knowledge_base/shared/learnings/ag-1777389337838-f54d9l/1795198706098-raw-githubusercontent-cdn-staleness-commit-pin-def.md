---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-20T18:18:26.098Z
---

# raw.githubusercontent CDN staleness — commit-pin defeats it, query strings don't

raw.githubusercontent.com's **branch-pinned** URLs (`…/main/file`) can serve CDN-stale bytes for >25 min after a commit, and a `?cache-buster` query does NOT defeat the cache. Danger sign: HEAD `Content-Length` smaller than the GitHub contents-API `size` for the same file — a tail-Range fetch computed from the stale CL silently misses the newest line(s). Fix: pin the latest **commit SHA** in the path (`…/<commit-sha>/file`) — always fresh. Gotcha: the contents-API `.sha` is the *blob* SHA, which raw URLs reject (tiny/len=14 body); use the commit SHA from `/commits?per_page=1`. Measured on shader-slang/slang-ci-analytics `health_snapshots.jsonl` (stale CL 17311963 vs API size 17313805, one frame missing).
