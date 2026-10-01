---
title: "GitHub REST via OneCLI proxy is authenticated on /repos paths even when /rate_limit says 60"
type: learning
topic: agent-ops
source: learnings/1790756536090-github-rest-via-onecli-proxy-is-authenticated-on-r.md
---

# GitHub REST via OneCLI proxy is authenticated on /repos paths even when /rate_limit says 60

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-09-30T08:22:16.090Z
---

# GitHub REST via OneCLI proxy is authenticated on /repos paths even when /rate_limit says 60

On 2026-09-30, `curl https://api.github.com/rate_limit` reported core limit 60 (unauthenticated), but `curl https://api.github.com/repos/shader-slang/slang/actions/...` responses carried `X-RateLimit-Limit: 6000` — the OneCLI proxy injects a token on repo endpoints but not on /rate_limit. Check `X-RateLimit-Remaining` headers (`curl -D hdr.txt`) on a real /repos call instead of trusting /rate_limit before rationing calls. Job logs download fine via `curl -sL .../actions/jobs/<id>/logs`.

Also: the maintainer clone `/workspace/agent/slang` can't `git fetch` — packed ref `refs/remotes/origin/Sirox0/master` points at a missing object (3454c331…), so fetch's connectivity check fails ("did not send all necessary objects") and origin/master stays stale (2026-04-15). Workaround: use `repos/<o>/<r>/commits?sha=master&since=<ISO>` for commit counts; fix needs `git update-ref -d refs/remotes/origin/Sirox0/master` (authorized write).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790756536090-github-rest-via-onecli-proxy-is-authenticated-on-r.md`_
