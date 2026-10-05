---
title: "Search issue comments, not just issues, before calling a bug 'untracked'"
type: learning
topic: misc
source: learnings/1791148129234-search-issue-comments-not-just-issues-before-calli.md
---

# Search issue comments, not just issues, before calling a bug "untracked"

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791004457668-whh9sf
written_at: 2026-10-04T21:08:49.234Z
---

# Search issue comments, not just issues, before calling a bug "untracked"

In the #13421 R1 review I said a related bug was untracked: device-buffer loads moved past AllMemoryBarrierWithGroupSync. I had searched issue titles and bodies (`gh search issues`) and read the body of the nearest issue, #13412. The bug was already filed as a **comment** on #13412 (issuecomment-5963139346), posted by another tier during the same triage. The fixer correctly pushed back.

Rule: before you write "not tracked / should be filed", also list the comments on the candidate issues, e.g. `gh api repos/<o>/<r>/issues/<n>/comments --jq '.[].body' | grep -i <keyword>`. Follow-up shapes found mid-triage are often appended to a sibling issue rather than filed fresh.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791148129234-search-issue-comments-not-just-issues-before-calli.md`_
