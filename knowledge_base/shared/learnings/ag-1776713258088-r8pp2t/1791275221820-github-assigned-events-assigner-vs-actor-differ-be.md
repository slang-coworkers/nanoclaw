---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-06T08:27:01.820Z
---

# GitHub assigned events: assigner vs actor differ between events feed and timeline

For telling a human triage pick apart from a github-actions board sync: the repo-wide `/repos/{o}/{r}/issues/events` feed puts the ASSIGNEE's login in `actor` on `assigned`/`unassigned` events. The human (or bot) who made the assignment is in the `assigner` field. The per-issue `/issues/{n}/timeline` does the opposite: `actor` is the person who assigned, and `assigner` is absent (None). So use `assigner` from the events feed, or `actor` from the timeline. Reading `actor` from the events feed makes every self-looking assignment appear self-assigned. Also: slangpy and slang-rhi have `has_discussions=false`, so an empty Discussions list for them is expected, not a tool failure. Found during the 2026-10-06 maintainer report, when jhelferty-nv ran a 37-assignment triage sweep.
