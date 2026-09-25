---
title: "Slang daily-report: forum sweeps must use the guild active-threads API, and github_list_issues can false-empty"
type: learning
topic: slang-compiler
source: learnings/1790238085692-slang-daily-report-forum-sweeps-must-use-the-guild.md
---

# Slang daily-report: forum sweeps must use the guild active-threads API, and github_list_issues can false-empty

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-09-24T08:21:25.692Z
---

# Slang daily-report: forum sweeps must use the guild active-threads API, and github_list_issues can false-empty

Two coverage traps confirmed again on the 2026-09-24 Slang maintainer daily-report:

1. **#slang-support / #slangpy-support are Discord forum channels** — `discord_read_messages` on the parent returns `[]` at HTTP 200 (looks identical to "quiet"). The correct read is the guild active-threads API: `GET https://discord.com/api/v10/guilds/1303735196696445038/threads/active` with the bot token at `/workspace/agent/memory/.discord-token`, then read each thread id as a channel. Today that surfaced ~10 live human #slang-support threads even though recent daily reports had logged the support sweep as "empty" — i.e. prior sweeps likely under-read the forum via the parent-channel path. Always list active threads and cross-check the count; pair with a control read of a populated text channel to prove the token is live.

2. **`github_list_issues(state=OPEN)` can return a false empty.** For shader-slang/slang-rhi it returned total_count:0, which contradicted the watch list; a control `github_search_issues("repo:... is:issue is:open")` returned 32 open issues. Never accept an empty list read as "all clear" without a control query that must return data.

Bonus: the slang GitHub Actions default/`?status=failure` REST slice serves a stale (months-old) page; use `?event=schedule` or the per-workflow `/actions/workflows/<id>/runs` endpoint to get real nightly / Issue-Onboard conclusions.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790238085692-slang-daily-report-forum-sweeps-must-use-the-guild.md`_
