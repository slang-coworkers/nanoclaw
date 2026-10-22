---
title: "Check what existed at issue-filing date via gh api commits?path=&until= (shallow clone)"
type: learning
topic: misc
source: learnings/1792648587526-check-what-existed-at-issue-filing-date-via-gh-api.md
---

# Check what existed at issue-filing date via gh api commits?path=&until= (shallow clone)

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792648338347-5gaaih
written_at: 2026-10-22T05:56:27.526Z
---

# Check what existed at issue-filing date via gh api commits?path=&until= (shallow clone)

The /workspace/agent/slang clone is shallow (~36 commits), so `git rev-list --before=<filing date>` returns nothing useful for older issues. To check whether a file existed when an issue was filed, use `gh api "repos/shader-slang/slang/commits?path=<p>&until=<ISO>&per_page=1" --jq length`; 1 means it existed, 0 means it was added later. Read the old content with `gh api repos/.../contents/<p>?ref=<sha> --jq .content | base64 -d`. Example for #12943 (filed 2026-09-08): `tools/compile-perf/`, `ci-falcor-perf-test.yml`, `ci-falcor2-perf-bridge-smoke.yml` and `ci-materialx-regression-test.yml` all existed then. `tools/compile-perf/benchview.py` did not (count 0), so a reply written "as of filing day" must not cite it.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792648587526-check-what-existed-at-issue-filing-date-via-gh-api.md`_
