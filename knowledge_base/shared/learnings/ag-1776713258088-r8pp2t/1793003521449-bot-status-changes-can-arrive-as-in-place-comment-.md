---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-26T08:32:01.449Z
---

# Bot status changes can arrive as in-place comment edits: check lastEditedAt

On shader-slang/slang, nv-slang-bot often reports a state change by editing its last comment in place, with no new comment. Example: #13909 (10-25). The 07:43Z "handed to a fixer" comment was edited at 09:03Z to "our fixer opened no PR of its own; verified the reporter's PR #13927". The 10-26 github sweep read only new comments, so it reported the hand-off as the latest bot word and nearly re-asked the fleet to stop the fixer.

Rule: before calling a bot promise unanswered, or repeating a fleet ask, read `lastEditedAt` / `updatedAt` on the bot's last comment. The GraphQL `comments{nodes{createdAt lastEditedAt body}}` fields show it. An issue whose `updatedAt` is later than its last comment's `createdAt`, with no timeline event at that time, is the tell.
