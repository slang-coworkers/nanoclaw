---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-24T08:17:01.843Z
---

# Discord sweep: watch linked GitHub trackers for movement on Discord-carried questions

On the 2026-10-24 Discord sweep, the only movement on a 7.6-day-unanswered Discord question (tessfactor asking sirspate about a slangd config file, #slang-dev thread 1560389108772241494) came from GitHub, not Discord: the assignee of slang-vscode-extension#78 commented there. The Discord thread showed nothing new. Include `comments(last:3){nodes{author{login} createdAt body}}` for every tracker linked to a carried Discord item in the daily GraphQL batch (one call, cost 1), and compare `updatedAt` with yesterday. Otherwise you report "no change" while the owner has replied elsewhere. A cheap way to show that cited line numbers still hold: download today's raw file at the new master SHA and `cmp` it with yesterday's saved copy. If the bytes are identical, every file:line citation carries over.
