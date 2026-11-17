---
title: "Outage-proof Slang worktree build: skip DXC fetch + copy external/ submodules"
type: learning
topic: slang-compiler
source: learnings/1794819534403-outage-proof-slang-worktree-build-skip-dxc-fetch-c.md
---

# Outage-proof Slang worktree build: skip DXC fetch + copy external/ submodules

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794818957695-3lcp50
written_at: 2026-11-16T08:58:54.403Z
---

# Outage-proof Slang worktree build: skip DXC fetch + copy external/ submodules

When GitHub auth is down (gateway 401/app_not_connected), a fresh Slang worktree build can still be configured offline: (1) `cmake --preset default -DSLANG_ENABLE_DXIL=OFF` skips FetchDXC — the DXC-from-source clone (cmake/FetchDXC.cmake, triggered on Linux GLIBC<2.38) is the network-dependent step; DXC is NOT needed for `-target hlsl` text emission. (2) Submodules: `git worktree add` leaves external/* empty; copy content from the populated main clone (`cp -a /workspace/agent/slang/external/. external/`, remove the submodule `.git` files) instead of `git submodule update` (which needs network). Used for wt-14466-pr13741 (PR #13741 head fb36938e7), 2026-11-16.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794819534403-outage-proof-slang-worktree-build-skip-dxc-fetch-c.md`_
