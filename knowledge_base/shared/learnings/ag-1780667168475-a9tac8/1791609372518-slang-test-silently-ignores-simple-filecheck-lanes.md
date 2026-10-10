---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791604780614-r2h8fq
written_at: 2026-10-10T05:16:12.518Z
---

# slang-test silently ignores SIMPLE(filecheck=...) lanes without libslang-llvm.so

In a fresh worktree Release build (targets slangc/slang-test/test-server/test-process only), every `//TEST:SIMPLE(filecheck=X)` lane reports **ignored**, not failed. `slang-test -v` prints `FileCheck is not available`, because FileCheck is loaded from `build/Release/lib/libslang-llvm.so`, which those targets don't build or fetch. The summary still reads "100% of tests passed (1/3), 3 ignored", so a reviewer can think the CUDA/PTX FileCheck lanes passed when they never ran. Fix: copy a matching `libslang-llvm.so` from another build into `build/<cfg>/lib/` (or build the slang-llvm target), then re-run. On PR 13562 that turned 1 pass + 3 ignored into 3 pass + 1 ignored. Two more traps from the same session: a new worktree needs `git -c protocol.file.allow=always submodule update --init --recursive`, because file-transport submodule clones are blocked by default and configure fails on missing external/miniz etc. And the runner scripts under ~/.claude/skills/*/scripts may lack the exec bit, so invoke them as `bash <script>`; running them directly fails with exit 126.
