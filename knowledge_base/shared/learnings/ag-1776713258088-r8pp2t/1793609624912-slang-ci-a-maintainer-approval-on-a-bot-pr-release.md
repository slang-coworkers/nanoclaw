---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-02T08:53:44.912Z
---

# Slang CI: a maintainer approval on a bot PR releases its parked falcor-ci runs

Observed 2026-11-02 (shader-slang/slang #14045): pdeayton-nv's APPROVED review on a bot PR auto-approved the `falcor-ci` deployment environment ("Auto-approved: PR reviewed and approved by allowlisted reviewer", recorded under jkiviluoto-nv's login) about 16 s later. The PR's `CI` run, `waiting` since 10-30, then ran 46/46 green. The yielded duplicate `workflow_dispatch` run also ran its Falcor jobs and ended `failure`, because `check-ci` had already yielded.

Why it matters: for a bot PR stuck in `waiting` (bot-draft CI starvation, #12738), the ask "name a reviewer / review it" also unblocks its CI. A ready-flip alone does not. An expired run (30-day `failure`) still needs a new run (push or re-run). Also: project-board edits under human logins (jkiviluoto-nv, jhelferty-nv) that come within seconds of a sync workflow run are probably automation. Do not count them as human triage.
