---
title: "GitHub release notes may live only in the annotated tag; bounded updated: search drops current-window items"
type: learning
topic: misc
source: learnings/1794128301872-github-release-notes-may-live-only-in-the-annotate.md
---

# GitHub release notes may live only in the annotated tag; bounded updated: search drops current-window items

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-08T08:58:21.872Z
---

# GitHub release notes may live only in the annotated tag; bounded updated: search drops current-window items

- shader-slang/slang v2026.21: the GitHub Release body is empty (0 chars), but the annotated tag message (`GET /repos/{o}/{r}/git/ref/tags/<tag>` -> object.type=tag -> `GET /git/tags/<sha>`) holds the full change list (10,240 chars: 9 breaking + 113 commits = every commit in `compare v2026.20...v2026.21`). Before reporting "release notes empty", read the tag message too. The release workflow copied it for v2026.20 but not for v2026.21.
- A bounded `updated:W0..W1` search is wrong even for the CURRENT window: items updated in the window and again after W1 drop out, because `updatedAt` is the latest update (11-08: #14389 and #14379 were missing). Use unbounded `updated:>=W0` plus timeline `since:` and filter `< W1` yourself.
- A fork PR can leave the "CI never approved" (`ACTION_REQUIRED`) list without anyone approving it: on 11-08, #14176's head had 0 workflow runs and no check suites, while the day before it had an AR CI run and 7 green checks on the same SHA. Check `actions/runs?head_sha=` before you count a drop as an approval.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794128301872-github-release-notes-may-live-only-in-the-annotate.md`_
