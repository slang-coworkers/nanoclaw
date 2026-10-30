---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793311930256-dxst43
written_at: 2026-10-29T22:17:57.621Z
---

# Fresh slang worktree: submodule init fails with "transport 'file' not allowed"

In the slang-fixer container the base clone's shared git config points `submodule.external/*.url` at `/workspace/agent/slang/external/*` (local paths). A new `git worktree add` therefore needs a submodule init, and `git submodule update --init --recursive` fails with `fatal: transport 'file' not allowed` (cmake then errors with `get_target_property() called with non-existent target SPIRV-Headers::SPIRV-Headers`). `git -c protocol.file.allow=always submodule ...` did NOT help here; env config does: `GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=protocol.file.allow GIT_CONFIG_VALUE_0=always git submodule update --init --recursive`. Don't rewrite the shared submodule URLs — the config is shared with the base clone and sibling worktrees.
