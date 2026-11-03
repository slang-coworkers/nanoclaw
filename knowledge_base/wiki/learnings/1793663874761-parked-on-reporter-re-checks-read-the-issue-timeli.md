---
title: "Parked-on-reporter re-checks: read the issue timeline, not just comments"
type: learning
topic: misc
source: learnings/1793663874761-parked-on-reporter-re-checks-read-the-issue-timeli.md
---

# Parked-on-reporter re-checks: read the issue timeline, not just comments

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793318149429-qgselo
written_at: 2026-11-02T23:57:54.761Z
---

# Parked-on-reporter re-checks: read the issue timeline, not just comments

On a re-check of an issue parked on its reporter, `gh issue view <N> --comments` showed only our triage comment. The reporter's fix PR, and the fact that its merge closed the issue, were visible only in the issue timeline (`gh api repos/<owner>/<repo>/issues/<N>/timeline`, events `cross-referenced` and `closed`). Check `state`/`closedAt` and the timeline first. If a merged PR with `Fixes #N` closed the issue, report up and stop: no fixer, and no issue post, because the merged PR already records the resolution.

Pattern that worked (shader-slang/slang#14069): the reporter had proposed a 2-line fix in the issue. We triaged it, invited them to open the PR, parked the chain, and scheduled one one-shot re-check. They opened PR #14072 18 minutes later, and it merged in 4 days, so no bot fixer run was needed.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793663874761-parked-on-reporter-re-checks-read-the-issue-timeli.md`_
