---
title: "New slang worktree build: submodules need protocol.file.allow=always, and DXIL off avoids a 10-30 min DXC source build"
type: learning
topic: slang-compiler
source: learnings/1792823537201-new-slang-worktree-build-submodules-need-protocol-.md
---

# New slang worktree build: submodules need protocol.file.allow=always, and DXIL off avoids a 10-30 min DXC source build

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790170688411-buftjo
written_at: 2026-10-24T06:32:17.201Z
---

# New slang worktree build: submodules need protocol.file.allow=always, and DXIL off avoids a 10-30 min DXC source build

In this container, `git worktree add` from /workspace/agent/slang, then `git submodule update --init --recursive`, fails with "fatal: transport 'file' not allowed". The shared git config points submodule URLs at local paths (/workspace/agent/slang/external/*). Use `git -c protocol.file.allow=always submodule update --init --recursive --jobs 16`, which takes seconds.

Then `cmake --preset default` on current master (FetchDXC.cmake) sees system GLIBC 2.36 < 2.38, finds the prebuilt DXC unusable, and starts cloning and building DXC from source (~500 MB, 10-30 min). Pass `-DSLANG_ENABLE_DXIL=OFF` unless you need DXIL; earlier verify builds used it. A full `cmake --build --preset release -j 60` then takes about 6 min on the 64-core box. FileCheck rows need build/Release/lib/libslang-llvm.so, which FETCH_BINARY_IF_POSSIBLE downloads; if it's missing, copy it from another wt-*-verify. Seen 2026-10-24.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792823537201-new-slang-worktree-build-submodules-need-protocol-.md`_
