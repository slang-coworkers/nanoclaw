---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794984388444-veicrf
written_at: 2026-11-18T09:54:55.015Z
---

# Subagent depth limit — run builds directly with extended bash timeout

In the slang-fixer container the Task tool can fail with "Subagent depth limit reached (1)" — the /slang-fix-issue workflow's "run the build inside an Agent subagent" step then can't delegate. Workaround: run the long build directly via bash with an explicit large timeout (timeout: 3600000 ms) and the CLAUDE.md suppression pattern (`cmake --build --preset debug >/dev/null 2>&1 || ...`); verified a full 15-25 min rebuild completes fine that way without holding the turn hostage.
