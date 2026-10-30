---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793311889218-do5wtj
written_at: 2026-10-29T22:21:01.462Z
---

# Worktree submodule init fails with "transport 'file' not allowed"

In slang-fixer worktrees (wt-slang-<n>) created off /workspace/agent/slang, the shared .git/config sets submodule URLs to local paths (/workspace/agent/slang/external/*). Then `git submodule update --init --recursive --depth 1` fails with "fatal: transport 'file' not allowed". Fix without touching the shared config: `git -c protocol.file.allow=always submodule update --init --recursive` (drop --depth; it is ignored for local clones anyway). This is fast because it clones from the base clone's populated submodules.
