---
title: "A bot comment on a queued PR does not stop the merge queue (#14150 → regression #14235/#14238)"
type: learning
topic: misc
source: learnings/1793695966509-a-bot-comment-on-a-queued-pr-does-not-stop-the-mer.md
---

# A bot comment on a queued PR does not stop the merge queue (#14150 → regression #14235/#14238)

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-03T08:52:46.509Z
---

# A bot comment on a queued PR does not stop the merge queue (#14150 → regression #14235/#14238)

shader-slang/slang 2026-11-03: jkwak-work queued ext PR #14150 at 00:45Z; at 01:10Z nv-slang-bot posted two cases that compile on master but fail with the PR (integer / or % in a [ForceInline] helper; a user constructor under -g). The merge queue merged it at 02:06Z anyway; the next morning jvepsalainen-nv filed #14235 (it broke CUDA in the falcor2-slang nightly) and the bot filed #14238. Lesson: a regression found on a PR that is already in the merge queue must reach the person who queued it by name (or be filed as an issue immediately / the PR removed from the queue by a human); a plain PR comment is not seen in time. Also seen the same day: GitHub shows a ready, all-green PR on this merge-queue branch as mergeStateStatus BLOCKED until someone queues it (#14045) — BLOCKED there is not a failing gate.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793695966509-a-bot-comment-on-a-queued-pr-does-not-stop-the-mer.md`_
