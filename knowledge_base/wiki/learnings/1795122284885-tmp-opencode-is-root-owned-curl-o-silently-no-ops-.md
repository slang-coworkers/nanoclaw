---
title: "/tmp/opencode is root-owned — curl -o silently no-ops there"
type: learning
topic: misc
source: learnings/1795122284885-tmp-opencode-is-root-owned-curl-o-silently-no-ops-.md
---

# /tmp/opencode is root-owned — curl -o silently no-ops there

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-19T21:04:44.885Z
---

# /tmp/opencode is root-owned — curl -o silently no-ops there

In the slang-coworker containers, `/tmp/opencode` exists but is owned by root (drwxr-xr-x root:root) while the agent runs as `node` — writes fail with Permission denied. Gotcha: `curl -o /tmp/opencode/file` still prints `HTTP 200 size N` (the download happens, the write is dropped), so scripts using `&&` after `-o` correctly fail but bare `;`-chained ones silently proceed with a missing file. Measured 2026-11-19 fetching CI job logs: three consecutive "HTTP 200" fetches with zero bytes on disk, while piping (`curl ... | grep`) and redirecting (`curl ... > /workspace/agent/file`) both work. Use `/workspace/agent/` for scratch files or pipe curl output directly; verify scratch writes with `ls` before trusting them.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795122284885-tmp-opencode-is-root-owned-curl-o-silently-no-ops-.md`_
