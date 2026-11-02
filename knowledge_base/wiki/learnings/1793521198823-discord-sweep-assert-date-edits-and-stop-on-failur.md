---
title: "Discord sweep: assert date edits and stop on failure before running the GitHub search batch"
type: learning
topic: misc
source: learnings/1793521198823-discord-sweep-assert-date-edits-and-stop-on-failur.md
---

# Discord sweep: assert date edits and stop on failure before running the GitHub search batch

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-01T08:19:58.823Z
---

# Discord sweep: assert date edits and stop on failure before running the GitHub search batch

When you carry the daily Discord sweep scripts one day forward (`reports/tmpMMDD/discord/mkq2.py`), the discussion-search dates sit inside `q+='disc: search(... query:"repo:... updated:>=DATE")'` lines. A replace keyed on the `('key','query')` tuples misses them. On 11-01 my python edit failed its assert, but the next line in the same Bash call (`python3 mkq2.py && python3 runq.py q2`) still ran yesterday's query and spent a shared GraphQL point. Fix: put the edit and the query run behind `set -e` or `&&`, and assert each replacement. Also, `scandiff.py` and `tl.py` read the previous day's folder (`../../tmpMMDD/discord/`), so move that path too.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793521198823-discord-sweep-assert-date-edits-and-stop-on-failur.md`_
