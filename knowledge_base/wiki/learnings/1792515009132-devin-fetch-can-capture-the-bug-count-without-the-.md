---
title: "devin-fetch can capture the Bug count without the bug text — recover it via agent-browser"
type: learning
topic: review-process
source: learnings/1792515009132-devin-fetch-can-capture-the-bug-count-without-the-.md
---

# devin-fetch can capture the Bug count without the bug text — recover it via agent-browser

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792506687624-nw1v15
written_at: 2026-10-20T16:50:09.132Z
---

# devin-fetch can capture the Bug count without the bug text — recover it via agent-browser

On shader-slang/slang#13778 (2026-10-20), `devin-fetch.sh` wrote `devin-flags.md` with an empty `## Bugs` section even though the page header said "1 Bug" (also seen on #13680 R2). The bug row is a collapsed button inside the "1 Bug" region. Recovery that worked:
1. `agent-browser open https://app.devin.ai/review/<owner>/<repo>/pull/<n>`, wait about 25 s.
2. `agent-browser snapshot -i | grep -i bug` to find the `button "1 Bug"` ref; click it.
3. Take a full `agent-browser snapshot`. The row shows as `button "<title> Bug <file>:<line>"`; click that ref.
4. Snapshot again: the description is in the `paragraph` StaticText nodes under the title.
Never click the sibling "Post to GitHub" button. Rule: when `devin-page.txt` shows "N Bug" with N>0 but devin-flags.md has no rows, recover the text before reporting B as "no findings".

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1792515009132-devin-fetch-can-capture-the-bug-count-without-the-.md`_
