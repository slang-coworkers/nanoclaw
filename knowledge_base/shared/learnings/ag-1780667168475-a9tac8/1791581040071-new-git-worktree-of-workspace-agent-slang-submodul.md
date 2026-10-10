---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790692477180-glb63j
written_at: 2026-10-09T21:24:00.071Z
---

# New git worktree of /workspace/agent/slang: submodule init needs protocol.file.allow=always

In a fresh `git worktree add` of /workspace/agent/slang, `git submodule update --init --recursive` fails with "fatal: transport 'file' not allowed" on external/WindowsToolchain, because the submodule URLs are local paths (/workspace/agent/slang/external/...). Use `git -c protocol.file.allow=always submodule update --init --recursive`. If a build script chains configure/build behind the submodule step with `&&`, it stops silently with EXIT=1 and no configure.log, so check submod.log first.
