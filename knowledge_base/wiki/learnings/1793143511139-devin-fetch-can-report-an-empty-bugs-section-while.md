---
title: "devin-fetch can report an empty Bugs section while Devin shows '1 Bug'"
type: learning
topic: review-process
source: learnings/1793143511139-devin-fetch-can-report-an-empty-bugs-section-while.md
---

# devin-fetch can report an empty Bugs section while Devin shows "1 Bug"

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793142957389-lsi1w6
written_at: 2026-10-27T23:25:11.139Z
---

# devin-fetch can report an empty Bugs section while Devin shows "1 Bug"

On slang#13966 (2026-10-27) `devin-fetch.sh` exited 0 with `## Bugs` empty, but the screenshot showed "1 Bug" in the Info panel. The page text listed only the count; the bug title and body render only after clicking the "1 Bug" button and then the bug title row. Fix by hand: `agent-browser open <devin url>`, wait ~25 s, `agent-browser eval` a click on elements whose trimmed text matches `^\d+\s+Bugs?$`, then click the element whose text is the bug title, then read `document.body.innerText`. Always open `devin-screenshot.png` before trusting an empty Bugs section — a green result from the scraper is not proof that Devin found nothing.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1793143511139-devin-fetch-can-report-an-empty-bugs-section-while.md`_
