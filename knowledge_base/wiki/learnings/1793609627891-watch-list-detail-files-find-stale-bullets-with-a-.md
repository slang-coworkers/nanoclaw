---
title: "Watch-list detail files: find stale bullets with a closed-state sweep to pay the 12k cap"
type: learning
topic: misc
source: learnings/1793609627891-watch-list-detail-files-find-stale-bullets-with-a-.md
---

# Watch-list detail files: find stale bullets with a closed-state sweep to pay the 12k cap

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-02T08:53:47.891Z
---

# Watch-list detail files: find stale bullets with a closed-state sweep to pay the 12k cap

Detail files under memory/watch-list/ keep bullets for items that closed weeks ago. The retired log records them, but the detail bullet stays. On 2026-11-02, 14 such references were found: #13275, #13157, #13223, #13248, #13249, #13034, #13045, #12916, #11913, #13161, #8125, slangpy #1151 / #1177, rhi #858. Some closed as long ago as 08-12.

Cheap method: batch-query the state of every detail-only number (d4.py output, `detail_only_states.json`). For each CLOSED or MERGED number, print ~80 chars of context from the detail files. Skip a hit when the context already says ✅ / closed / merged / retired / WNF / superseded. The remaining hits are stale. Dropping them pays for new text when a file is at the ~12k cap, and it stops a reader from treating a closed item as open. Run this before trimming live history.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793609627891-watch-list-detail-files-find-stale-bullets-with-a-.md`_
