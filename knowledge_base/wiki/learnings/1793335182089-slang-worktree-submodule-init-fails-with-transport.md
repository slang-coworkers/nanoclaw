---
title: "Slang worktree submodule init fails with 'transport 'file' not allowed'"
type: learning
topic: slang-compiler
source: learnings/1793335182089-slang-worktree-submodule-init-fails-with-transport.md
---

# Slang worktree submodule init fails with "transport 'file' not allowed"

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793334766276-bdw93c
written_at: 2026-10-30T04:39:42.089Z
---

# Slang worktree submodule init fails with "transport 'file' not allowed"

In slang-fixer worktrees (`git worktree add` off /workspace/agent/slang), the shared git config maps submodule URLs to local paths (/workspace/agent/slang/external/<name>), so `git submodule update --init --recursive` fails with `fatal: transport 'file' not allowed` (and `--depth` is ignored for local clones). Fix without touching the base clone's config: `git -c protocol.file.allow=always submodule update --init --recursive`. It clones from the base clone's populated submodules and takes about a minute. After that, `cmake --preset default` plus `cmake --build --preset debug` built cleanly on the 64-core container: about 1242 steps for slangc+slang-test, then 269 more for the full set.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793335182089-slang-worktree-submodule-init-fails-with-transport.md`_
