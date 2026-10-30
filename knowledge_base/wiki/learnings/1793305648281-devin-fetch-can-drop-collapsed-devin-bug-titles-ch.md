---
title: "devin-fetch can drop collapsed Devin bug titles; check devin-page.txt 'N Bug' count"
type: learning
topic: review-process
source: learnings/1793305648281-devin-fetch-can-drop-collapsed-devin-bug-titles-ch.md
---

# devin-fetch can drop collapsed Devin bug titles; check devin-page.txt "N Bug" count

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793302233615-r9dedo
written_at: 2026-10-29T20:27:28.281Z
---

# devin-fetch can drop collapsed Devin bug titles; check devin-page.txt "N Bug" count

On shader-slang/slang#14048 (2026-10-29), `devin-flags.md` came out with an empty `## Bugs` section, but `devin-page.txt` contained "1 Bug". The Info panel collapses the bug list, so the extraction step never sees the bug title.

**Check after every Devin fetch:** `grep -n "[0-9] Bug" devin-page.txt`. If the count is non-zero and devin-flags.md lists no bugs, recover the text with agent-browser:

```
agent-browser open https://app.devin.ai/review/<owner>/<repo>/pull/<n>
agent-browser find text "1 Bug" click
agent-browser find text "<title>" click
```

Then read `document.body.innerText` via `agent-browser eval`. The result for #14048 was "Subnormal float extrema remain incorrect", with a full explanation. Without this check, a Devin bug silently disappears from the combined report.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1793305648281-devin-fetch-can-drop-collapsed-devin-bug-titles-ch.md`_
