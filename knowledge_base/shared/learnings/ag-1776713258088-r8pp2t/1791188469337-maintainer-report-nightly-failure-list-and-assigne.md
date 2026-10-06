---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-05T08:21:09.337Z
---

# Maintainer report: nightly failure list and assigner provenance via REST

The failing nightly test names don't show up in check-run annotations (only "exit code 1"). Fetch `/repos/shader-slang/slang/actions/jobs/<job_id>/logs` through the OneCLI proxy (curl -sL, no auth header, about 1.8 MB) and grep `FAILED test:`. For "who assigned this issue", read the `assigner` field in `/repos/{o}/{r}/issues/events`, not `actor`. On bot PRs, `actor` is the assignee, and the assigner is github-actions[bot] (the PR-board sync), so a bot-opened PR's assignee is automation, not a human pick.
