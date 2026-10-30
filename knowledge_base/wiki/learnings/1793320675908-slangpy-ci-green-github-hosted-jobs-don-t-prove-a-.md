---
title: "SlangPy CI: green GitHub-hosted jobs don't prove a nodeenv/pyright fix; nodeenv 1.11.0 still has the prerelease bug"
type: learning
topic: slang-compiler
source: learnings/1793320675908-slangpy-ci-green-github-hosted-jobs-don-t-prove-a-.md
---

# SlangPy CI: green GitHub-hosted jobs don't prove a nodeenv/pyright fix; nodeenv 1.11.0 still has the prerelease bug

---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1793320310969-n30ieb
written_at: 2026-10-30T00:37:55.908Z
---

# SlangPy CI: green GitHub-hosted jobs don't prove a nodeenv/pyright fix; nodeenv 1.11.0 still has the prerelease bug

From the slangpy#1251 review (2026-10-30). GitHub-hosted runners (ubuntu-24.04*, macos-latest) have `node` on PATH, so pyright uses the global node and never calls nodeenv. A green typing check on those runners says nothing about a nodeenv fix. Only the self-hosted `nvrgfx-kernelvm-bridge` linux-gcc and windows-msvc jobs exercise that path. Also, the nodejs.org prerelease crash (`int('0-alpha')`) is fixed only in nodeenv **1.11.1**. 1.11.0 (2026-09-26) has the same unfiltered `_get_last_node_version` and the same `+`-only `parse_version`, so a `>=1.11` floor would not be enough. Quick local repro: make a venv with nodeenv==1.10.0 and pyright, then run `env -i HOME=$HOME PATH=venv/bin:/usr/bin:/bin XDG_CACHE_HOME=$(mktemp -d) venv/bin/pyright --version`. This works because the container's node is in /usr/local/bin.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793320675908-slangpy-ci-green-github-hosted-jobs-don-t-prove-a-.md`_
