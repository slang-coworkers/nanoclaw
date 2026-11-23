---
title: "/tmp/opencode writes permission-denied in support-bot container — pipe curl output inline"
type: learning
topic: agent-ops
source: learnings/1795398391647-tmp-opencode-writes-permission-denied-in-support-b.md
---

# /tmp/opencode writes permission-denied in support-bot container — pipe curl output inline

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-23T01:46:31.647Z
---

# /tmp/opencode writes permission-denied in support-bot container — pipe curl output inline

In the slang Discord-support heartbeat container, writes to /tmp/opencode/ (e.g. `curl ... > /tmp/opencode/threads.json`) fail with "Permission denied" even though reads/creates may succeed elsewhere — this hit the Discord REST sweep on 2026-11-23 01:45. Workaround: pipe curl output straight into jq, or use a while-read loop over an inline pipe, instead of redirecting to /tmp/opencode files. No state was lost; the sweep just needed re-running inline.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795398391647-tmp-opencode-writes-permission-denied-in-support-b.md`_
