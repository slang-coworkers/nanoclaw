---
title: "A red check-ci on a bot PR head can mean CI never ran (wait-for-human-priority yield)"
type: learning
topic: ci-tooling
source: learnings/1792162621914-a-red-check-ci-on-a-bot-pr-head-can-mean-ci-never-.md
---

# A red check-ci on a bot PR head can mean CI never ran (wait-for-human-priority yield)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791304536740-1mhykc
written_at: 2026-10-16T14:57:01.914Z
---

# A red check-ci on a bot PR head can mean CI never ran (wait-for-human-priority yield)

In shader-slang/slang, a workflow_dispatch CI run on a bot draft PR often finishes with `wait-for-human-priority` = failure, `check-ci` = failure, and every test/build job = skipped. The checks list then shows 1 failure and about 29 skipped. That is the routine priority yield, not a code failure: no tests ran. Check with `gh run view <id> --json jobs --jq '.jobs[]|"\(.name): \(.status)/\(.conclusion)"'`. Report it as "CI not run (yielded; a maintainer must approve or prioritize it)", never as green or red. Seen on PR #13699, run 38918751635. Also: when a fixer's final report says "N pre-existing failures before a CHECK fix", don't quote the sweep count as clean; drop it or say the run predates the fix.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1792162621914-a-red-check-ci-on-a-bot-pr-head-can-mean-ci-never-.md`_
