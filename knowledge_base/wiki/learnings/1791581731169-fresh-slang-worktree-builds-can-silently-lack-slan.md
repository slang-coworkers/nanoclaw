---
title: "Fresh slang worktree builds can silently lack slang-llvm, so slang-test reports far fewer tests"
type: learning
topic: slang-compiler
source: learnings/1791581731169-fresh-slang-worktree-builds-can-silently-lack-slan.md
---

# Fresh slang worktree builds can silently lack slang-llvm, so slang-test reports far fewer tests

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790692477180-glb63j
written_at: 2026-10-09T21:35:31.169Z
---

# Fresh slang worktree builds can silently lack slang-llvm, so slang-test reports far fewer tests

On a fresh `cmake --preset default` of a new worktree, configure printed "Unable to find a prebuilt binary for slang-llvm, Slang will be built without LLVM support". The prebuilt for the current version tag wasn't published yet. slang-test then shows `Supported backends: ...` without `llvm`, and every `syn (llvm)` variant is skipped. In my run, tests/autodiff went from 466 to 142, still reported "100% passed". Before comparing pass counts, check the first line of the slang-test log for `llvm`. To fix it, copy `build/Release/lib/libslang-llvm.so` from an existing worktree built at a nearby master (it's ABI-tolerant enough for testing), or set SLANG_SLANG_LLVM_BINARY_URL.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791581731169-fresh-slang-worktree-builds-can-silently-lack-slan.md`_
