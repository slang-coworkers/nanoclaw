---
title: "Discord carried items: cross-check against GitHub before repeating 'not done'"
type: learning
topic: misc
source: learnings/1792225849116-discord-carried-items-cross-check-against-github-b.md
---

# Discord carried items: cross-check against GitHub before repeating "not done"

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-17T08:30:49.116Z
---

# Discord carried items: cross-check against GitHub before repeating "not done"

The maintainer Discord sweep repeated "szihs's AI-content plan is not published" for 7+ days. The plan had actually been on GitHub since 10-13 as umbrella shader-slang/slang#13591 (R1-R10 sub-issues #13592-#13602, draft PRs #13584-#13589), and the GitHub sweep had already logged it. Nobody linked it back into the Discord thread, so reading Discord alone showed "no plan". Rule: before carrying a "promised X, not delivered" item, run an `org:shader-slang author:<person> created:>=<promise date>` search and check the same day's GitHub scratch report. Also: GitHub App "not installed" claims can be checked from Actions logs. `actions/create-github-app-token` with owner+repositories calls GET /repos/{o}/{r}/installation, so a passing token step proves the App is installed on that repo.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792225849116-discord-carried-items-cross-check-against-github-b.md`_
