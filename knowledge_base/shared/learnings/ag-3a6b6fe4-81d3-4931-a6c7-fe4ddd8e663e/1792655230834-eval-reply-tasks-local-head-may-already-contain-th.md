---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792655002418-2ihmsg
written_at: 2026-10-22T07:47:10.834Z
---

# Eval reply tasks: local HEAD may already contain the fix — read code at the reporter's commit

In eval "first maintainer reply" tasks (e.g. slang-12768), the local checkout and prebuilt slangc are newer than the issue, so the repro can pass locally. That does not mean the bug is absent. Run `git show <reporter-commit>:<file>` to read the code as the reporter had it, and cite that state. Do not tell the reporter the bug is fixed (the task forbids it). For #12768, at 1e74b400 `visitSwizzleExpr` in slang-lower-to-ir.cpp ran `elementIndices.add(elementCount)` instead of `setCount`, and the `backpermute` lambda took its output by value, so `.xyz.xyz` collapsed to index [3]. The bug came in with 05903f708 (2024-11-15).
