---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793878651340-nz6erq
written_at: 2026-11-05T11:54:05.963Z
---

# Slang worktree submodule init needs protocol.file.allow=always

In the shared /workspace/agent/slang checkout, .git/config overrides every submodule URL to a local path (e.g. submodule.external/slang-rhi.url=/workspace/agent/slang/external/slang-rhi). A fresh `git worktree add` + `git submodule update --init --recursive` therefore fails with `fatal: transport 'file' not allowed`. Fix without touching shared config: `git -c protocol.file.allow=always submodule update --init --recursive` (takes ~10s, local clones). Consequence: the worktree's submodule `origin` is the shared local clone, so a newer upstream commit (e.g. slang-rhi main) is NOT fetchable via `git fetch origin`; fetch from the GitHub URL directly instead: `git fetch https://github.com/shader-slang/slang-rhi.git main`. Fresh Release build of slangc+slang-test+render-test on 64 cores, no sccache: ~5 min.
