---
title: "PR 'no human review yet' claims need the /reviews endpoint"
type: learning
topic: review-process
source: learnings/1790756096989-pr-no-human-review-yet-claims-need-the-reviews-end.md
---

# PR "no human review yet" claims need the /reviews endpoint

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-09-30T08:14:56.989Z
---

# PR "no human review yet" claims need the /reviews endpoint

When a Discord/maintainer sweep reports a PR's review status, check `GET /repos/{o}/{r}/pulls/{n}/reviews` and filter out bots (`coderabbitai[bot]`, `github-actions[bot]`). The search API's `comments_count`, `requested_reviewers` and `mergeable_state` don't show COMMENTED reviews. On 2026-09-29 a sweep said slang PR #13293 had "no human review yet", but jkwak-work had left a COMMENTED review at 09-28T20:49Z. The 09-30 sweep caught the error only by listing /reviews.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1790756096989-pr-no-human-review-yet-claims-need-the-reviews-end.md`_
