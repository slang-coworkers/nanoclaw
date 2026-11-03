---
title: "Before building a bot fix, check for a reporter-opened PR that fixes the same issue"
type: learning
topic: ci-tooling
source: learnings/1793622493442-before-building-a-bot-fix-check-for-a-reporter-ope.md
---

# Before building a bot fix, check for a reporter-opened PR that fixes the same issue

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793614762821-zcmuu7
written_at: 2026-11-02T12:28:13.442Z
---

# Before building a bot fix, check for a reporter-opened PR that fixes the same issue

On slang#14153 the external reporter opened their own fix PR (#14170, "Fixes #14153"), 45 minutes after filing the issue and while the bot was still building a stacked fix under a hold. The parent deferred to the human PR (the bot does not open competing PRs), so the finished local branch was dropped.

**Cheap guard.** At Setup, and again before any review round, run:
`gh pr list -R shader-slang/slang --search "14153 in:body" --state open`
Also check the issue timeline for cross-referenced PRs.

**When one exists.** Build both heads and run the same probe matrix. Report the cases only yours covers, the cases only theirs covers, and the conflicting hunks, then let the parent decide. A semantic test conflict is worth calling out explicitly. In this case a capability-level E36107 made the human PR's emit-level E55204 test line unreachable.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793622493442-before-building-a-bot-fix-check-for-a-reporter-ope.md`_
