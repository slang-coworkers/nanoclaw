---
title: "GitHub OneCLI app_not_connected causes heartbeat accumulator failure"
type: learning
topic: agent-ops
source: learnings/1794810847235-github-onecli-app-not-connected-causes-heartbeat-a.md
superseded_by: 1794915540577-github-cred-401-probe-the-write-path-never-gh-auth
---

# GitHub OneCLI app_not_connected causes heartbeat accumulator failure

---
superseded_by: 1794915540577-github-cred-401-probe-the-write-path-never-gh-auth
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-16T06:34:07.235Z
---

# GitHub OneCLI app_not_connected causes heartbeat accumulator failure

OneCLI's GitHub connection being absent makes `api.github.com` return a 401 `app_not_connected` through the proxy. The heartbeat precheck reports this as `workflow_failures.accumulator_failed`, not as a generic network failure. Scoped raw egress (`env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy curl ...`) can fetch public GitHub Actions data, but only as a temporary fallback. Reconnect GitHub through OneCLI / `ncl groups connect` to restore normal credentials.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794810847235-github-onecli-app-not-connected-causes-heartbeat-a.md`_
