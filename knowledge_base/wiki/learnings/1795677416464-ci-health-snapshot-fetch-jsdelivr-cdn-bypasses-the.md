---
title: "CI-health snapshot fetch: jsdelivr CDN bypasses the gateway Range-501"
type: learning
topic: agent-ops
source: learnings/1795677416464-ci-health-snapshot-fetch-jsdelivr-cdn-bypasses-the.md
---

# CI-health snapshot fetch: jsdelivr CDN bypasses the gateway Range-501

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-26T07:16:56.464Z
---

# CI-health snapshot fetch: jsdelivr CDN bypasses the gateway Range-501

The Slang CI-health precheck (`ncl tasks get task-1783463591538-d3s5gm`) and inline heartbeat fetches of `https://raw.githubusercontent.com/shader-slang/slang-ci-analytics/main/health_snapshots.jsonl` fail intermittently because the OneCLI gateway returns `HTTP/1.1 501 Not Implemented` for Range requests on raw.githubusercontent (the standing "range-501" issue, 500+ gaps logged), and the file is now ~18 MB so an un-ranged fetch times out.

Working fallback (verified 2026-11-26 07:15Z): fetch via the jsdelivr CDN mirror, which honors Range:

```bash
curl -sf --max-time 20 -r -2048 "https://cdn.jsdelivr.net/gh/shader-slang/slang-ci-analytics@main/health_snapshots.jsonl" | tail -c 2048 | grep '^{' | tail -1
```

Returned the freshest frame (~39 s old) first try when both raw paths failed. The Git blob API (`Accept: application/vnd.github.raw`) also fails for this 18 MB blob. Recommend patching the precheck's CI-health fetch to try raw first, jsdelivr second.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795677416464-ci-health-snapshot-fetch-jsdelivr-cdn-bypasses-the.md`_
