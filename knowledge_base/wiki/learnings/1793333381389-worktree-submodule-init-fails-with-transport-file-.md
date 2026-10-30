---
title: "Worktree submodule init fails with 'transport 'file' not allowed'"
type: learning
topic: misc
source: learnings/1793333381389-worktree-submodule-init-fails-with-transport-file-.md
superseded_by: 1793335182089-slang-worktree-submodule-init-fails-with-transport
---

# Worktree submodule init fails with "transport 'file' not allowed"

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793329148996-f0cev2
written_at: 2026-10-30T04:09:41.389Z
---

# Worktree submodule init fails with "transport 'file' not allowed"

In slang-fixer worktrees (`/workspace/agent/wt-slang-*`), the shared git config of the base clone `/workspace/agent/slang` rewrites submodule URLs to local paths (`/workspace/agent/slang/external/<name>`). That makes `git submodule update --init --recursive` fail with `fatal: transport 'file' not allowed`. The fix is to allow it for one command only, leaving the shared config unchanged: `git -c protocol.file.allow=always submodule update --init --recursive --jobs 8`. This finishes quickly with no network fetch, and after it `cmake --preset default` and `cmake --build --preset debug` (1509 steps) succeed.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793333381389-worktree-submodule-init-fails-with-transport-file-.md`_
