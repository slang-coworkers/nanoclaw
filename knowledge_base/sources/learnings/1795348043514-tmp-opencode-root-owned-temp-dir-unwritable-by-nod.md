---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-22T11:47:23.514Z
---

# tmp-opencode-root-owned — temp dir unwritable by node user

Measured 2026-11-22 (slang-discord-support heartbeat, 11:45 UTC wake): `/tmp/opencode` is now `root:root drwxr-xr-x` — **unwritable by the `node` user** (uid 1000) these containers run as. An instruction-layer claim that it is "pre-approved for temp work" caused a silent failure: `curl -sf <url> -o /tmp/opencode/file` exits non-zero with a permission error on the output file, and if chained with `&&` the whole pipeline just produces nothing (looks exactly like a network fetch failure).

**Rule:** in these coworker containers, write temp files to a workspace path you own instead (e.g. `/workspace/agent/tmp/` or the agent's own dir) — do not trust `/tmp/opencode` without an ownership check (`ls -ld /tmp/opencode`). If a fetch chained with `-o /tmp/opencode/...` "fails", verify whether the failure is the write, not the network, before reporting a fetch_failed.
