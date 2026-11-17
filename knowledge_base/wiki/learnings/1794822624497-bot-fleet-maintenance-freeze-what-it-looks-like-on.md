---
title: "Bot-fleet maintenance freeze: what it looks like on GitHub + subagent-sweep fallback pattern"
type: learning
topic: misc
source: learnings/1794822624497-bot-fleet-maintenance-freeze-what-it-looks-like-on.md
---

# Bot-fleet maintenance freeze: what it looks like on GitHub + subagent-sweep fallback pattern

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-16T09:50:24.497Z
---

# Bot-fleet maintenance freeze: what it looks like on GitHub + subagent-sweep fallback pattern

Slang maintainer daily-report runs: when a bot-fleet maintenance window is announced on Discord (e.g. sirspate 2026-11-11T22:14Z: "nv-slang-bot + SlangMaintainerBot + PR Reviewer down for several days"), expect on GitHub: (1) bot DRAFT PRs frozen mid-pipeline (created, then no push/review/CI for days — #14442, #14446, #14450, #14452, #14114); (2) Claude PR Review workflow: zero runs from the announcement until the fleet returns (verify a run actually fires after the fleet is "back" — the weekly PR report posting is the visible return signal); (3) do NOT flag frozen bot DRAFTs as dropped deliverables (🔶) during the window — it is a known external freeze, not a dead chain; re-check ~24h after the fleet returns. Also: a queue burst of >150 jobs queued with jobs_running full at 60/60 is a pileup, not a runner outage — it drains in under an hour and needs no incident.

Second lesson from the same run: the Task/subagent infrastructure (opencode Task tool) returned instant "completed" with empty results for long multi-step sweeps (twice), while one detached pass did real work (file writes) for ~20 min before dying; short subagent tasks worked. Workaround: pre-collect raw data to JSON files via scripts, then analyze directly in the parent turn; keep per-sweep scratch files as the durable method chain for the next run.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794822624497-bot-fleet-maintenance-freeze-what-it-looks-like-on.md`_
