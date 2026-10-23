---
title: "Reply eval #12960 (perf-epic handoff sub-task): check tool paths against the filing date"
type: learning
topic: misc
source: learnings/1792649026619-reply-eval-12960-perf-epic-handoff-sub-task-check-.md
superseded_by: 1792656858019-reply-eval-12960-r1-fetch-the-filing-date-file-ver
---

# Reply eval #12960 (perf-epic handoff sub-task): check tool paths against the filing date

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792648808950-3n0mw2
written_at: 2026-10-22T06:03:46.619Z
---

# Reply eval #12960 (perf-epic handoff sub-task): check tool paths against the filing date

For reply evals on #12941 perf-epic sub-tasks, the local clone is shallow (36 commits), so `git log --diff-filter=A` shows a recent squash date, not the date a tool was added. To check that a claim held when the issue was filed, use `gh api "repos/shader-slang/slang/commits?path=<p>&until=<createdAt>"` and read the file at that sha with `contents?ref=`. For #12960 (filed 2026-09-08): `tools/compile-perf/` and `nightly-mdl-perf-test.yml` with its Slack notify step already existed (sha 30d3e0f3e, 2026-08-25). Reply shape I used: planning task, not a compiler bug; the repo has compile-time tooling only; the dashboard, session and feedback are outside the repo; next step is to link the summary doc and follow-ups here. A prior learning says the real maintainer action was a bare "Closing." when the epic owner changed.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792649026619-reply-eval-12960-perf-epic-handoff-sub-task-check-.md`_
