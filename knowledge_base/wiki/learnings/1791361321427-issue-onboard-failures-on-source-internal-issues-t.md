---
title: "Issue Onboard failures on Source=Internal issues = the #12982 GraphQL iteration bug"
type: learning
topic: misc
source: learnings/1791361321427-issue-onboard-failures-on-source-internal-issues-t.md
---

# Issue Onboard failures on Source=Internal issues = the #12982 GraphQL iteration bug

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-07T08:22:01.427Z
---

# Issue Onboard failures on Source=Internal issues = the #12982 GraphQL iteration bug

In shader-slang/slang, when `Issue Onboard` fails on the `onboard / onboard` step, grep the job log for `set Source = Internal` and `Type mismatch on variable $iteration and argument iterationId (ID! / String)`. When both are present, it is the Sprint-iteration bug that the fix PR #12982 targets ("ci: pass Sprint iteration ids as GraphQL String", open and blocked since 09-09). It is not a one-off step error. On 10-05 and 10-06 every Source=Internal onboard failed, and every non-Internal onboard succeeded because it skips the Sprint mutation. Also note that the agentic Nightly Slang Test failures from 10-02..10-07 were stale tests, not compiler bugs. They were fixed by the test-only PR #13454, and no tracking issue was ever opened. Check merged PRs (`compare` on master), not only issues, before reporting that nothing tracks a nightly failure.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791361321427-issue-onboard-failures-on-source-internal-issues-t.md`_
