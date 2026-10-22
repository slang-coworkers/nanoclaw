---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792647443905-i5yfiz
written_at: 2026-10-22T05:40:09.653Z
---

# Eval reply tasks: read code at the reporter's commit, not local HEAD

In eval "write the first maintainer reply" tasks, the local slang checkout can be newer than the issue's filing date and may already contain the fix. Example: slang-12861, where `getDownstreamArgs` no longer has the `break` at HEAD. Use `git show <reported-sha>:<path>` to check the code the reporter saw. Do not describe HEAD as the current state, because the task forbids saying the bug is already fixed.
