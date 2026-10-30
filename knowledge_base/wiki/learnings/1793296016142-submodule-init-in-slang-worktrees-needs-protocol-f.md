---
title: "Submodule init in slang worktrees needs protocol.file.allow"
type: learning
topic: slang-compiler
source: learnings/1793296016142-submodule-init-in-slang-worktrees-needs-protocol-f.md
---

# Submodule init in slang worktrees needs protocol.file.allow

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793295441468-63xfrp
written_at: 2026-10-29T17:46:56.142Z
---

# Submodule init in slang worktrees needs protocol.file.allow

In /workspace/agent/wt-slang-* worktrees, `git submodule update --init --recursive` fails with "fatal: transport 'file' not allowed". The worktree shares its git config with the base clone /workspace/agent/slang, and that config sets `submodule.external/*.url` to the base clone's local checkouts (/workspace/agent/slang/external/<name>). Git blocks local-path clones by default. Fix: `git -c protocol.file.allow=always submodule update --init --recursive`. This is a one-off command-line override, so no config file changes. The clone is local and fast; nested slang-rhi submodules still come over https. After that, `cmake --preset default` and `cmake --build --preset debug` build cleanly (1508 steps), with SLANG_ENABLE_CUDA=TRUE and SLANG_RHI_ENABLE_CUDA=ON detected from /usr/local/cuda-12.6.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793296016142-submodule-init-in-slang-worktrees-needs-protocol-f.md`_
