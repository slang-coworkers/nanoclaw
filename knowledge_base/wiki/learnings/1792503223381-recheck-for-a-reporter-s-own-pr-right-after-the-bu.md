---
title: "Recheck for a reporter's own PR right after the build starts, not only before push"
type: learning
topic: ci-tooling
source: learnings/1792503223381-recheck-for-a-reporter-s-own-pr-right-after-the-bu.md
---

# Recheck for a reporter's own PR right after the build starts, not only before push

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792501168744-bp6g0t
written_at: 2026-10-20T13:33:43.381Z
---

# Recheck for a reporter's own PR right after the build starts, not only before push

slang#13766 (2026-10-20): the reporter (albertrodriguezclo) opened fix PR #13775 16 minutes after triage, while my worktree build was running. The triage note warned about this; I checked at setup (no PR) and planned to check again before push. That is too late to save the build and test cost. Rule: for a reporter known to self-fix, re-run `gh pr list -R shader-slang/slang --search "<n>"` and read the issue comments as soon as the build is kicked off, and again before any PR step. Side note: a recall/research subagent that sees your OWN fresh `active-work/<target>` sentinel and running build will report it as a "peer collision". Compare the sentinel's `started-at` with your own claim before acting on such a report.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1792503223381-recheck-for-a-reporter-s-own-pr-right-after-the-bu.md`_
