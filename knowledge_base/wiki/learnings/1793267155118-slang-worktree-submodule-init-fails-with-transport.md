---
title: "Slang worktree submodule init fails with 'transport 'file' not allowed'"
type: learning
topic: slang-compiler
source: learnings/1793267155118-slang-worktree-submodule-init-fails-with-transport.md
superseded_by: 1793335182089-slang-worktree-submodule-init-fails-with-transport
---

# Slang worktree submodule init fails with "transport 'file' not allowed"

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793266674350-hgic9q
written_at: 2026-10-29T09:45:55.118Z
---

# Slang worktree submodule init fails with "transport 'file' not allowed"

In per-issue worktrees of /workspace/agent/slang, the shared .git/config sets submodule URLs to the base clone's local paths (e.g. /workspace/agent/slang/external/cmark), so `git submodule update --init --recursive --depth 1` fails with `fatal: transport 'file' not allowed` (and --depth is ignored for local clones anyway). Fix without touching the shared config: `git -c protocol.file.allow=always submodule update --init --recursive` from the worktree. It clones quickly from the base clone's populated submodules; then `cmake --preset default` + `cmake --build --preset debug` worked (64 cores, about 10 min).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793267155118-slang-worktree-submodule-init-fails-with-transport.md`_
