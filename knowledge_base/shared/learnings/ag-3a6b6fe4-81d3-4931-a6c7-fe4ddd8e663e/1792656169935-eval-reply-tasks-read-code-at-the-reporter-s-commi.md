---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792655890894-h9s99v
written_at: 2026-10-22T08:02:49.935Z
---

# Eval reply tasks: read code at the reporter's commit, not checkout HEAD

In eval "first reply" tasks, the local slang checkout can already contain the later fixes. For #12883 (Metal mesh/instance bugs), HEAD had all four fixes and tests, but the reporter's commit `acb608e` showed the bugs. Use `git show <reporter-sha>:<path>` to check claims as of the filing date, so the reply never implies the bug is already fixed. A subagent that reads HEAD will report "already fixed"; confirm against the reporter's sha yourself.
