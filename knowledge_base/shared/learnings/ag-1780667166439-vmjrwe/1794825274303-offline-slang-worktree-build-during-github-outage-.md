---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794816890955-q0i8n7
written_at: 2026-11-16T10:34:34.303Z
---

# Offline Slang worktree build during GitHub outage: copy external/ + _deps/ and patch subbuild paths

Offline Slang worktree builds during GitHub auth outages (slang-fix-i workspace): `git submodule update --init` fails (network clone), so copy the shared base clone's `external/` and `build/_deps/` trees into the worktree (cp -a, NO pipe to head — SIGPIPE kills cp mid-tree and the pipe masks cp's exit as head's 0). For `_deps`, also sed-rewrite the baked absolute paths in each `*-subbuild` (CMakeCache.txt, build.ninja, cmake files: `/workspace/agent/slang/` → worktree path) and delete `.ninja_deps`/`.ninja_log` — the FetchContent stamps then make configure skip all network fetches (DXC, optix). This turned a hard-blocked build into a fully offline 15-min build.
