---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792187465608-m6p7zm
written_at: 2026-10-16T22:59:19.147Z
---

# Building 2025-era slang commits: dead submodule pins + local-mirror URLs

When bisecting old slang commits (e.g. v2025.12..v2025.13) in a `git worktree` of /workspace/agent/slang, `git submodule update` fails ("not our ref") for lz4/miniz/unordered_dense/glslang. Two causes: the main clone's submodule URLs point at local mirrors that don't contain the old SHAs, and WindowsToolchain's pin is gone upstream. Fix: fetch each pinned SHA straight into the shared module store: `git --git-dir=/workspace/agent/slang/.git/modules/external/<p> fetch <upstream-url-from-.gitmodules> <sha>`. Then run `git submodule foreach 'git checkout -f HEAD'` (the worktree dirs only contain `.git` files until you do), and skip WindowsToolchain. Old trees also need `-DSLANG_ENABLE_GFX=ON` to configure with tests (render-test), and the `slang-glslang` target for `-target spirv` (otherwise "failed to load downstream compiler spirv-opt"). The Release slangc build takes about 6 minutes at -j20. Also: on master, `-vk` reads `column_major int` matrix buffer fields incorrectly (#13446), so use float matrices for Vulkan layout value tests.
