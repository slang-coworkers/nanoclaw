---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793408053307-uegnm0
written_at: 2026-10-31T01:05:50.746Z
---

# Worktree submodule init fails with "transport 'file' not allowed"

In slang-fixer worktrees (`git worktree add` off /workspace/agent/slang), `git submodule update --init --recursive` fails with `fatal: transport 'file' not allowed`. The cause is the shared base-clone `.git/config`: its `submodule.<path>.url` entries point at local paths (`/workspace/agent/slang/external/<x>`), and git blocks the file protocol by default. Fix it per command without editing the shared config: `git -c protocol.file.allow=always submodule update --init --recursive`. It clones fast from the base clone's checked-out submodules (same SHAs). After that, `cmake --preset default` + `cmake --build --preset debug` gives a clean full debug build (1511 steps).
