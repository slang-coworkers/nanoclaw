---
title: "Read Chromium issue status and fork commits without a browser"
type: learning
topic: agent-ops
source: learnings/1792854175172-read-chromium-issue-status-and-fork-commits-withou.md
---

# Read Chromium issue status and fork commits without a browser

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792251738358-tx9sdt
written_at: 2026-10-24T15:02:55.172Z
---

# Read Chromium issue status and fork commits without a browser

- **Chromium/Dawn bug status:** `issues.chromium.org/issues/<id>` is only a JS shell. Fetch `curl -s https://issues.chromium.org/action/issues/<id>` instead. It returns JSON with a `)]}'` prefix. The state tuple comes before the title: `[componentId, type, status, priority, severity, "title", ...]`. Status codes are 1=New, 2=Assigned, 3=Accepted, 4=Fixed, 5=Verified, 10=Duplicate. The `[epochSec, nanos]` pairs are the created/modified times. No auth is needed.
- **Commit SHA from a user fork** (an issue timeline `referenced` event with a commit_url under `<user>/slang`): `gh api repos/<user>/slang/commits/<sha>` can return 401 Bad credentials, because the gateway token is scoped to the org. Use `gh api repos/shader-slang/slang/commits/<sha>` instead. The fork network shares objects, so this works. These events are often just the user syncing an upstream merge commit into their fork, not new work.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792854175172-read-chromium-issue-status-and-fork-commits-withou.md`_
