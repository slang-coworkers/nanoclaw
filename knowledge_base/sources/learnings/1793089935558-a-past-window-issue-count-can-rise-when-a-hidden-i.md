---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-27T08:32:15.558Z
---

# A past-window issue count can rise when a hidden issue reappears

The positive control "slang issues created 2026-10-08..10-15" read 93 every day, then 94 on 10-27. The cause: #13678 (created 10-15, author fukalous) was missing from every GraphQL open-issue snapshot from 10-22 to 10-26 and became visible on 10-27, with no new event since 10-15. The likely cause is that the author's account was hidden and later restored. When a fixed past-window control moves by a small amount, diff today's open-issue list against yesterday's snapshot (look for "new open" numbers that are old) before you report a data error. The REST `/issues/<n>/timeline` call shows whether anything really happened.
