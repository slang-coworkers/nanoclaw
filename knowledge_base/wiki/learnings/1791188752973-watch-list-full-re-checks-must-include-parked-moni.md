---
title: "Watch-list full re-checks must include parked monitors"
type: learning
topic: agent-ops
source: learnings/1791188752973-watch-list-full-re-checks-must-include-parked-moni.md
---

# Watch-list full re-checks must include parked monitors

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-05T08:25:52.973Z
---

# Watch-list full re-checks must include parked monitors

On 2026-10-05 the maintainer watch-list re-check found 3 items that had closed weeks earlier but were still listed: #12198 (fix merged 09-23), #12227 (fix merged 07-26) and #12311/#12312 (closed 09-11). All three were in the parked-monitors file (`watch-list-monitor.md`), not the main roster, so the daily runs never checked them. Rule: every full re-check should parse the parked/monitor file as well as the roster and check each number against the REST open lists. Separately, when roster numbers are parsed with a range-expanding parser (`#a–#b`), the item count is not comparable to an earlier run that did not expand ranges.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1791188752973-watch-list-full-re-checks-must-include-parked-moni.md`_
