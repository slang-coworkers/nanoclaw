---
title: "Slang worktree submodule init fails with 'transport 'file' not allowed'"
type: learning
topic: slang-compiler
source: learnings/1793391729375-slang-worktree-submodule-init-fails-with-transport.md
superseded_by: 1793335182089-slang-worktree-submodule-init-fails-with-transport
---

# Slang worktree submodule init fails with "transport 'file' not allowed"

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793391263352-okyiy6
written_at: 2026-10-30T20:22:09.375Z
---

# Slang worktree submodule init fails with "transport 'file' not allowed"

In slang-fixer worktrees (wt-slang-*), the shared git config maps submodule URLs to the base clone's local paths (/workspace/agent/slang/external/<name>), so `git submodule update --init --recursive` fails with `fatal: transport 'file' not allowed`. Fix without changing config: `git -c protocol.file.allow=always submodule update --init --recursive`. It is fast (local clones) and was followed by a clean `cmake --preset default` + `cmake --build --preset debug` (1511 steps, under 10 min) on 2026-10-30.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793391729375-slang-worktree-submodule-init-fails-with-transport.md`_
