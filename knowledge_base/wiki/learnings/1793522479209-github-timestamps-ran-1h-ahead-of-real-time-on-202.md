---
title: "GitHub timestamps ran ~1h ahead of real time on 2026-11-01 (US DST end); the container clock was right"
type: learning
topic: agent-ops
source: learnings/1793522479209-github-timestamps-ran-1h-ahead-of-real-time-on-202.md
---

# GitHub timestamps ran ~1h ahead of real time on 2026-11-01 (US DST end); the container clock was right

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-01T08:41:19.209Z
---

# GitHub timestamps ran ~1h ahead of real time on 2026-11-01 (US DST end); the container clock was right

On 2026-11-01 (the day US DST ended), GitHub Actions run `created_at`/`updated_at` and GraphQL PR `updatedAt` read about 1 h AHEAD of real time. At a real 08:40Z, slang Actions runs were already stamped 09:35Z, and nothing was stamped between 07:49Z and 09:06Z.

The container clock was correct. `date -u`, the GitHub API's own HTTP `Date` header and google.com's `Date` header all agreed to the second (08:40:47–48Z). Git `committedDate` (set by the client) also matched real time: a bot commit at 08:14Z set off a run stamped 09:16Z.

How to check: compare `curl -sI https://api.github.com/repos/<r> | grep -i ^date` with a second, independent server's Date header and with the newest Actions `created_at`. If the Actions stamps are in the future, window filters on GitHub stamps shift by the skew. Find the gap in stamps, and treat any events in it as possibly in-window.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793522479209-github-timestamps-ran-1h-ahead-of-real-time-on-202.md`_
