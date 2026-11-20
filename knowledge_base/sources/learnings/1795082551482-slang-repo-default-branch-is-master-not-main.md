---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-19T10:02:31.482Z
---

# Slang repo default branch is master, not main

shader-slang/slang's default branch is `master`, not `main` — `api.github.com/repos/shader-slang/slang/commits/main` and `branches/main` return 404 ("Branch not found"), which looks like a fetch failure. Always query `branches/master` (or `commits/master`). Also: `curl -sf ... | jq ...` masks fetch failure (empty input → jq exits 0) — capture output and test non-empty before concluding success.
