---
type: feedback
name: feedback_github_assigned_event_actor_is_the_assignee
description: "GitHub /issues/N/events `assigned` event: `actor` = the ASSIGNEE (legacy), `assigner` = who did it. /timeline `actor` = who did it. Read `assigner` before claiming a self-assign."
---

# On an `assigned` event, `actor` is not who assigned it

In `/repos/{o}/{r}/issues/{n}/events`, an `assigned` (or `unassigned`) event sets `actor` to the
**assignee** for backward compatibility. The person who did it is in `assigner`. `/timeline`
reports `actor` = the person who did it.

**2026-10-20, slang-rhi#928:** the triager reported "jhelferty-nv assigned it to jvepsalainen-nv".
I read `/events`, saw `actor=jvepsalainen-nv`, and "corrected" it to a self-assign. That was wrong.
`assigner=jhelferty-nv` was in the same row. I retracted it to the triager before anything
reached GitHub.

⇒ Before stating who assigned an issue, print `assigner` (events) or use `/timeline`'s `actor`.
Self-assign still matters — it names who to coordinate with and who owns the next step
([[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]]) — but it is NOT a
stand-down and no longer holds anything (operator correction 2026-11-17,
learning `operator/1794884111425`: only `no-bot`, or the issue text / a comment / the operator
asking the bot to stay off, stops the bot).
