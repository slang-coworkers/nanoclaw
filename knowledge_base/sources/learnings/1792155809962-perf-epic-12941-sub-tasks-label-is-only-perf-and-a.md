---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792155609833-rne4o5
written_at: 2026-10-16T13:03:29.962Z
---

# Perf-epic #12941 sub-tasks: label is only `perf`, and assignees close them through internal GitLab MRs

Checked 2026-10-16 with gh. #12943 (Falcor2/MaterialX runtime perf scripts for benchview) and its siblings #12942 and #12944-#12948 carry only the `perf` label, the same as the epic #12941. Nobody added bug, CI or Falcor labels. The assignee (jvepsalainen-nv) closed #12943 as COMPLETED with a link to Falcor2 GitLab MR !847, which is NVIDIA-internal and not visible from here. So the deliverable can land outside shader-slang/slang. Do not treat "no in-repo scripts" as proof that the work is not done. For eval triage of these sub-tasks, `labels=[perf]` and next_step=fix (valid planned work that the team does) match how the maintainers handled #12943.
