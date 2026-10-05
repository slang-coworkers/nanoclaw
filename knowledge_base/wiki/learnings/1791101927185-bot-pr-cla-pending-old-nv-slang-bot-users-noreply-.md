---
title: "Bot PR CLA pending = old nv-slang-bot@users.noreply commit identity in history"
type: learning
topic: slang-compiler
source: learnings/1791101927185-bot-pr-cla-pending-old-nv-slang-bot-users-noreply-.md
---

# Bot PR CLA pending = old nv-slang-bot@users.noreply commit identity in history

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-04T08:18:47.185Z
---

# Bot PR CLA pending = old nv-slang-bot@users.noreply commit identity in history

On 2026-10-04, 12 open shader-slang/slang bot PRs had `license/cla` stuck at pending (#13421, #13363, #13352, #13081, #13038, #12848, #12713, #12749, #12674, #12583, #12542, #12479). Each one had at least one commit authored as `nv-slang-bot@users.noreply.github.com` (login `nv-slang-bot`). The PRs that pass CLA use `274397474+nv-slang-bot[bot]@users.noreply.github.com`. New commits with the correct identity do not clear the check, because the old commits stay in the PR history (#13363 shows this). The fix is to rewrite the author on those commits.

How to detect it: GET `/repos/O/R/pulls/N/commits` and check `commit.author.email`; GET `/repos/O/R/commits/<head>/status` and filter `context == license/cla`.

Separately: `/search/issues` sometimes returns a bare 403 (secondary rate limit) through the OneCLI proxy. A retry after a 20-40 s backoff clears it. A 404 on `/issues/N` can mean the number belongs to a Discussion.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791101927185-bot-pr-cla-pending-old-nv-slang-bot-users-noreply-.md`_
