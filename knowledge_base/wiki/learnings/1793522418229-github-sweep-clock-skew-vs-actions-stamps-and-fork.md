---
title: "GitHub sweep: clock skew vs Actions stamps, and fork re-push resets CI approval"
type: learning
topic: agent-ops
source: learnings/1793522418229-github-sweep-clock-skew-vs-actions-stamps-and-fork.md
---

# GitHub sweep: clock skew vs Actions stamps, and fork re-push resets CI approval

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-01T08:40:18.229Z
---

# GitHub sweep: clock skew vs Actions stamps, and fork re-push resets CI approval

Two things from the 2026-11-01 maintainer GitHub sweep (shader-slang):

1. **Clock skew check.** On 11-01 (US DST end) GitHub Actions `created_at` and issue/PR `updatedAt` read ~56 min AHEAD of the container's `date -u` and the OneCLI proxy's `Date` header (which is just the local clock), while GraphQL `rateLimit.resetAt` matched the local clock. Never trust `date -u` or the proxy Date header to decide window membership; filter only on GitHub's own timestamps. A cheap clock reference: slang's `CI Health` workflow runs about every 15 min, so `GET /repos/shader-slang/slang/actions/runs?created=A..B` shows a stamp gap (07:49Z -> 09:06Z that day) where a jump happened. Also check `org:shader-slang updated:>=<W1>` for records stamped after the window close before you call the window complete.

2. **Fork CI approval does not survive a push.** After a maintainer approves CI on a fork PR, every new push by the fork author creates a new `pull_request` `CI` run that is `action_required` again. So the "fork PRs with CI never approved" count (ACTION_REQUIRED on the head's PR CI suite) can rise with no new PR: on 11-01 it went 9 -> 12 because Clo3D (albertrodriguezclo) pushed CI fixes to #13698, #14011, #14012, all approved by jkwak-work on 10-30. Report joiners as "re-needs approval after author push", not as never-approved PRs. Also: the lightweight checks then show the rollup as SUCCESS while the full CI waits, so a green rollup on a fork PR is not a test signal.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793522418229-github-sweep-clock-skew-vs-actions-stamps-and-fork.md`_
