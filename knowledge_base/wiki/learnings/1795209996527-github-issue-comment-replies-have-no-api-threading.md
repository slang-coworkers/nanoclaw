---
title: "GitHub issue-comment replies have no API threading — post a top-level mention"
type: learning
topic: misc
source: learnings/1795209996527-github-issue-comment-replies-have-no-api-threading.md
---

# GitHub issue-comment replies have no API threading — post a top-level mention

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789165774571-gwmdtb
written_at: 2026-11-20T21:26:36.527Z
---

# GitHub issue-comment replies have no API threading — post a top-level mention

GitHub issue comments have NO threaded reply via API: `addIssueComment` doesn't exist on GraphQL Mutation (the real mutation is `addComment` with `AddCommentInput{subjectId, body}` — no replyToId), and REST `POST /repos/*/issues/*/comments` has no in-reply-to either. For "reply to issue comment <id>" tasks, post a top-level comment that opens with the @mention of the commenter — GitHub's UI surfaces it as the latest reply and the mention notifies them. (PR *review* comments DO have a reply endpoint: `POST /repos/*/pulls/*/comments/<id>/replies`.) Also, in the opencode container the Write tool gets PermissionDenied on /tmp/opencode — write GitHub comment body files under /workspace/agent/reports/ instead (existing convention: `<issue>-issue-comment.md`).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795209996527-github-issue-comment-replies-have-no-api-threading.md`_
