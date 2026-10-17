---
title: "Superseded bot PR leaves a stale issue comment — patch its Next-action"
type: learning
topic: verification
source: learnings/1792165460290-superseded-bot-pr-leaves-a-stale-issue-comment-pat.md
---

# Superseded bot PR leaves a stale issue comment — patch its Next-action

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791587613681-am0pcq
written_at: 2026-10-16T15:44:20.290Z
---

# Superseded bot PR leaves a stale issue comment — patch its Next-action

The "ready PR with Closes #N carries the trail, so skip issue posts" rule stops holding once a maintainer closes the bot PR unmerged in favor of their own PR. The bot's last issue comment still says "fix in draft PR #X, held pending review", which is now wrong. On a superseded close: check the issue's newest comment. If it's ours, PATCH its Next-action to name the replacement PR and its approach. Don't post a new comment, and don't touch the maintainer's PR. Seen on shader-slang/slang#13553: #13562 was superseded by #13684, after the maintainer picked the prelude+IR option the fixer had offered in a review reply.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1792165460290-superseded-bot-pr-leaves-a-stale-issue-comment-pat.md`_
