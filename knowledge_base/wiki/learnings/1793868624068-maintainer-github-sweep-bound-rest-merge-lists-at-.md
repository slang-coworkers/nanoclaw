---
title: "Maintainer GitHub sweep: bound REST merge lists at W1, and read workflow-run order before calling an assignment automation"
type: learning
topic: misc
source: learnings/1793868624068-maintainer-github-sweep-bound-rest-merge-lists-at-.md
---

# Maintainer GitHub sweep: bound REST merge lists at W1, and read workflow-run order before calling an assignment automation

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-05T08:50:24.068Z
---

# Maintainer GitHub sweep: bound REST merge lists at W1, and read workflow-run order before calling an assignment automation

From the 2026-11-05 maintainer GitHub sweep (scripts in /workspace/agent/reports/tmp1105/gh/):

1. **Put an upper bound on the REST closed-pulls window.** `m1.py` filtered `merged_at >= W0` with no `< W1`. A merge 3 minutes after W1 (#13829, 08:13:49Z) showed up as an 11-vs-10 disagreement with GraphQL `is:merged merged:W0..W1`. Filter `W0 <= merged_at < W1` (and the same for `closed_at`). m1.py in tmp1105 is fixed, so the next day's copy is right.

2. **A workflow run that starts 2-3 s after an assignment is a consequence, not the cause.** jhelferty-nv-attributed issue assignments are each followed by a `ClaudeCode - Slang Assistant` run (event `issues`, triggering_actor jhelferty-nv) that starts 2-3 s later. The assignment triggered that run. To call an assignment automation, look for a run that started BEFORE it (for example board sync about 7-10 s earlier). Also check for hand-written comments or label edits in the same minute. Query: `/repos/<o>/<r>/actions/runs?created=<t-90s>..<t+10s>`.

3. **A green rollup on a bot DRAFT can hide a CI run that is still waiting.** #14267 showed statusCheckRollup SUCCESS, but its CI run 41942522276 (workflow_dispatch) was `waiting`: 40 jobs skipped, 1 job waiting, and build/test never ran. Read the run itself (`/actions/runs/<id>/jobs`) before you call a bot draft green.

4. **GitHub issue search does not match exact phrases strictly.** `"patch release"` matched 2 issues that do not contain that phrase. Open the hits before you report that someone "discussed a patch release."

5. **The v2026.21 GitHub release body is empty (0 chars).** v2026.20 had about 14k chars. A missing release note is a real state to report, not a failed read.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793868624068-maintainer-github-sweep-bound-rest-merge-lists-at-.md`_
