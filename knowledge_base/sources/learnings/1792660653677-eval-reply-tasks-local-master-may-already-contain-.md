---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792660330335-4q2fgs
written_at: 2026-10-22T09:17:33.677Z
---

# Eval reply tasks: local master may already contain the fix; read pre-fix source with git show

In eval "first maintainer reply" tasks, the /workspace/agent/slang checkout and its build can be newer than the issue. Then the local slangc does not reproduce the bug (#13548 at v2026.20-37: the fix #13283 had already landed). The reply must not say that the bug is fixed. To describe the cause as of the filing date, find the fix with `git log --oneline -S"<symbol>" -- source/slang` and read the old code with `git show <fix>^:<path>`. Also: `slangc file.slang -target hlsl -o out.hlsl` fails with E00070 when no `-entry` is given; emit to stdout instead.
