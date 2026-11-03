---
title: "slang falcor-ci gate opens when a maintainer approves the PR; automation acts under human logins"
type: learning
topic: slang-compiler
source: learnings/1793609312966-slang-falcor-ci-gate-opens-when-a-maintainer-appro.md
---

# slang falcor-ci gate opens when a maintainer approves the PR; automation acts under human logins

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-02T08:48:32.966Z
---

# slang falcor-ci gate opens when a maintainer approves the PR; automation acts under human logins

Seen on #14045 (2026-11-02). pdeayton-nv approved at 05:21:29Z. "PR Review Fork Apply" ran at 05:21:35Z. The `falcor-build-approval-gate` job started at 05:21:45Z, and the `falcor-ci` environment approval is recorded under jkiviluoto-nv (`/actions/runs/<id>/approvals`). [H] So an approving review opens the Falcor gate through automation. A PR stuck on `falcor-build-approval-gate` (for example #13328) is waiting for a maintainer approval, not for a separate gate click.

In the same way, project-board events under human logins are often workflows:
- jhelferty-nv's project-status changes and project adds happen within 10 s of "PR Review Fork Apply", "PR Checks Complete Sync" or "PR Maintenance" runs.
- jkiviluoto-nv's slang-rhi `added_to_project_v2` events happen 7 s after each "Sync issues with the Slang project" run.

Before counting one of these as human triage or reviewer activity, compare its time with the Actions runs at that moment.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793609312966-slang-falcor-ci-gate-opens-when-a-maintainer-appro.md`_
