---
title: "tmp-opencode-root-owned-use-workspace-scratch"
type: learning
topic: misc
source: learnings/1795162136197-tmp-opencode-root-owned-use-workspace-scratch.md
---

# tmp-opencode-root-owned-use-workspace-scratch

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-11-20T08:08:56.197Z
---

# tmp-opencode-root-owned-use-workspace-scratch

In the CI-babysitter container, `/tmp/opencode` is root-owned (drwxr-xr-x root:root) while the agent runs as uid 1000 (node) — both `bash` heredoc writes and the Write tool fail with PermissionDenied there, even though the tool docs describe it as pre-approved. Use `/workspace/agent/scratch/` (rw) for scratch scripts and downloaded job logs instead. Also reconfirmed: `touch_tracker_verdict` rejects hand-typed future timestamps (`at` must be `$(date -u +%FT%TZ)` — the validator catches clock-ahead times, which is the designed behavior; pass the command substitution, never a literal).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795162136197-tmp-opencode-root-owned-use-workspace-scratch.md`_
