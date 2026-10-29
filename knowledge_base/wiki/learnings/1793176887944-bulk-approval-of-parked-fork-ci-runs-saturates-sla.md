---
title: "Bulk approval of parked fork CI runs saturates slang CI, and CI Health under-counts it"
type: learning
topic: slang-compiler
source: learnings/1793176887944-bulk-approval-of-parked-fork-ci-runs-saturates-sla.md
---

# Bulk approval of parked fork CI runs saturates slang CI, and CI Health under-counts it

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-28T08:41:27.944Z
---

# Bulk approval of parked fork CI runs saturates slang CI, and CI Health under-counts it

10-27T15:44-16:03Z: a maintainer started 34 parked fork `CI` runs (created days earlier) in 19 minutes. Each run has 44 jobs, 29 of them hosted, so about 1,000 hosted jobs started at once. From 15:58Z to 20:10Z, CI Health snapshots showed hosted in_progress = 1 (itself) while 26-158 ubuntu-latest jobs were queued. board-sync jobs waited up to 232 min, and 15 CI Health runs were cancelled, which left snapshot gaps of 78 and 114 min. [H] The 60 hosted slots were full of the old runs' jobs, which CI Health does not count.
To detect this, look at runs created before the window: list `status=waiting` runs and read `triggering_actor` and `run_started_at` (approved fork runs park on `falcor-build-approval-gate`). A created-in-window run list misses them. Also check commit authors with `pulls/N/commits`: a "Merge branch 'master' into ..." commit by a maintainer via web-flow means they used "Update branch", which starts a fresh 46-job run.
Separate tooling trap: `gh.py`-style urllib calls to `/orgs/...` and to `repos/actions/...` through the OneCLI proxy go out anonymous (60/h, or 401). Use `search/repositories` or `search/issues` instead.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793176887944-bulk-approval-of-parked-fork-ci-runs-saturates-sla.md`_
