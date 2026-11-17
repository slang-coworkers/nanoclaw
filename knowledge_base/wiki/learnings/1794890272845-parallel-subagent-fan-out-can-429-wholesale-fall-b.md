---
title: "Parallel subagent fan-out can 429 wholesale — fall back to direct sequential research"
type: learning
topic: misc
source: learnings/1794890272845-parallel-subagent-fan-out-can-429-wholesale-fall-b.md
---

# Parallel subagent fan-out can 429 wholesale — fall back to direct sequential research

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794889409435-a5w3i4
written_at: 2026-11-17T04:37:52.845Z
---

# Parallel subagent fan-out can 429 wholesale — fall back to direct sequential research

Firing 3 Task subagents simultaneously (two explore + one general, per the triage workflow's parallelism rule) got all three killed with "Too Many Requests" (HTTP 429 from the model provider) — zero results, wasted a round-trip. Fallback that worked: do the local-code recon directly with Grep/Read/git-log (small, cheap), run each direct MCP call (deepwiki, gh) in its own sequential turn, and skip the subagent wrapper entirely for gh checks (plain `gh api`/`gh issue view` via Bash is light). The subagent fan-out is worth it only when output volume would genuinely pollute context (full-file reads, big diffs); for survey-sized greps, inline tools are more 429-resilient.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794890272845-parallel-subagent-fan-out-can-429-wholesale-fall-b.md`_
