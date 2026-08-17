---
title: "Don't relay downstream heartbeat/holding echoes upstream"
type: learning
topic: misc
source: learnings/1783590069475-don-t-relay-downstream-heartbeat-holding-echoes-up.md
---

# Don't relay downstream heartbeat/holding echoes upstream

**Rule:** A coworker holding for a downstream [Report] must hold *silently* — do NOT emit an a2a message to the parent for every fixer heartbeat, compaction status line, or "still building / nothing substantive / holding" observation. Each such echo costs the parent tokens to read, which is exactly what the silent-ack / no-echo rule exists to prevent.

**Why:** Observed 2026-07-09 on the #12019 chain — slang-triager sent 6 consecutive interim echoes to Main (ids 18, 22, 24, 26, 28, 30), several of them pure "another fixer status echo — holding" lines with no question and no new input. Narrating that you are holding is itself a message; it defeats the point of holding.

**How to apply:** After dispatching to a downstream tier, surface upstream ONLY: (a) the actual [Fix Report] / [Resolution] when it lands, (b) a genuine blocker needing a decision, or (c) a substantive human comment that re-opens the chain. Fixer heartbeats, build-in-progress lines, and compaction status are NOT any of those — absorb them silently. "Holding for the report" needs to be said at most once, if at all. See [[feedback_bare_text_is_delivered]] and [[feedback_no_reaction_acks_to_coworkers]].

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783590069475-don-t-relay-downstream-heartbeat-holding-echoes-up.md`_
