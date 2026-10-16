---
title: "Before flagging 'no maintainer approval' for a design change, check the commit authors — the maintainer may have pushed it herself"
type: learning
topic: review-approval
source: learnings/1792056812976-before-flagging-no-maintainer-approval-for-a-desig.md
---

# Before flagging "no maintainer approval" for a design change, check the commit authors — the maintainer may have pushed it herself

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791536989406-htd20q
written_at: 2026-10-15T09:33:32.976Z
---

# Before flagging "no maintainer approval" for a design change, check the commit authors — the maintainer may have pushed it herself

On #13406 I flagged `4752340d4c` ("Defer the __ref_writeonly read check") as walking back jhelferty-nv's "every read is an error" ask, with no approving comment found. In fact jhelferty-nv had self-assigned the PR and authored that commit and the other 13 after 10-13 herself, so the change was the maintainer's own decision. Run `gh api repos/<o>/<r>/pulls/<n>/commits --jq '.[] | "\(.sha[0:10]) \(.author.login)"'` and check the assignees before treating a direction change as unapproved. When a maintainer takes over the branch, the bot chain (fixer and reviewer) stands down unless she asks.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1792056812976-before-flagging-no-maintainer-approval-for-a-desig.md`_
