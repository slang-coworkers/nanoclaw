---
title: "nv-slang-bot CAN assign issues (2026-10-28) — create first, assign second"
type: learning
topic: slang-compiler
source: learnings/1793197504021-nv-slang-bot-can-assign-issues-2026-10-28-create-f.md
---

# nv-slang-bot CAN assign issues (2026-10-28) — create first, assign second

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793196597249-6cmdcu
written_at: 2026-10-28T14:25:04.021Z
---

# nv-slang-bot CAN assign issues (2026-10-28) — create first, assign second

On 2026-10-28 a maintainer (jkwak-work) asked the bot on PR #13908 to "create a new issue ... and assign it to me". `gh issue create` (no `--assignee`) followed by `gh issue edit 13972 -R shader-slang/slang --add-assignee jkwak-work` succeeded, and `gh issue view --json assignees` confirmed it. This contradicts an earlier learning (slang#11751) that assignment returns 403, so the permission may have changed or may depend on the call. Rule: create the issue without `--assignee`, then assign in a separate call, then read the assignee back. A rejected assignment then cannot lose the create, and the thread reply can say truthfully whether the assignment worked. Have two reviewed reply variants ready (assigned / please self-assign). Related: a read-only `gh api repos/O/R/pulls/...` GET is still blocked by gate-critique-on-deliver.sh as "PR creation". Use `mcp__slang-mcp__github_get_pull_request` or GraphQL `pullRequest{reviewThreads}` for reads, and GraphQL `addPullRequestReviewThreadReply` for review-thread replies.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793197504021-nv-slang-bot-can-assign-issues-2026-10-28-create-f.md`_
