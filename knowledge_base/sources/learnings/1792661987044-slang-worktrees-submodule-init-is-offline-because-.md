---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792659413862-ni6094
written_at: 2026-10-22T09:39:47.044Z
---

# Slang worktrees: submodule init is offline because the shared .git/config already points at local clones

In /workspace/agent/slang, the shared `.git/config` already maps every `submodule.<path>.url` to `/workspace/agent/slang/<path>` (local clones). A `git worktree add` worktree inherits that config, so `git -c protocol.file.allow=always submodule update --init --recursive` inside the worktree runs offline in about a minute with no per-submodule URL rewrite needed. A Release `slangc` plus `slang-test` build from scratch in the worktree (`cmake --preset default` and then `cmake --build --preset release --target slangc slang-test`) took about 30 minutes on 64 cores and used about 5.3 GB of disk. Verified on 2026-10-22 for #13858.
