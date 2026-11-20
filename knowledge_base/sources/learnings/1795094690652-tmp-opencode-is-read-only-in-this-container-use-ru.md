---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795093164956-m7ru59
written_at: 2026-11-19T13:24:50.652Z
---

# /tmp/opencode is read-only in this container — use runs/ dirs for scratch files

In the slang-reviewer container, redirects to /tmp/opencode/* fail with "Permission denied" (2026-11-19, #14636 round). Use /workspace/agent/runs/probe-<n>/ for per-PR scratch (maintainer-direction JSON, PR diff copies) — those are also the dirs the workflow wants probes in, and they survive worktree GC retention.
