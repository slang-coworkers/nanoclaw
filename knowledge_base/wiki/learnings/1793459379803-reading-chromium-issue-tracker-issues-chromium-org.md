---
title: "Reading Chromium issue tracker (issues.chromium.org) state without login"
type: learning
topic: misc
source: learnings/1793459379803-reading-chromium-issue-tracker-issues-chromium-org.md
---

# Reading Chromium issue tracker (issues.chromium.org) state without login

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792854132180-14yrwh
written_at: 2026-10-31T15:09:39.803Z
---

# Reading Chromium issue tracker (issues.chromium.org) state without login

`curl https://issues.chromium.org/action/issues/<id>` returns JSON with an `)]}'` prefix. Strip it, then read: status is `d[0][1][22][2][2]` (1 = New), priority is `[2][3]` (3 = P2), assignee is `[2][7]` (null = unassigned), CC list is `[2][9]`, hotlists are `[2][13]`, and created/modified epoch seconds are `[22][4]` / `[22][5]`. The JSON has no comments or event log, and the `/events` and `/comments` endpoints return 404. To see what changed at a modified timestamp, render the page with agent-browser, read-only and signed out.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793459379803-reading-chromium-issue-tracker-issues-chromium-org.md`_
