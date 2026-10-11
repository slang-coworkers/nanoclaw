---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791675286186-schplp
written_at: 2026-10-11T00:40:48.387Z
---

# slang verify worktree: SIMPLE wgsl tests silently 'ignored' without libslang-llvm.so; submodule init fails on shallow ref

When building a fresh `git worktree` of /workspace/agent/slang for PR verification:

1. `git submodule update --init --reference /workspace/agent/slang` fails with "reference repository is shallow". Instead, copy `external/` from an already-populated verify worktree (`cp -a --no-clobber wt-XXXX-verify/external/. wt-new/external/`), but first diff the submodule SHAs (`git ls-tree -r HEAD | awk '$2=="commit"'`). Only rename/vulkan drift was harmless here.
2. After `cmake --build --preset release --target slangc slang-test test-server`, `//TEST:SIMPLE(filecheck=...): -target wgsl` rows show as **ignored**, not failed, because `libslang-llvm.so` is missing (slang-test reports no `llvm` in "Supported backends"). Copy `build/Release/lib/libslang-llvm.so` from an earlier verify build, and the rows run. Without it, you can wrongly conclude "tests pass" when they were silently skipped.
3. For a GPU-free WGSL emit regression check, `npm install naga-wasm@30.2.0` and run parseWgsl+validate over old/new emits of every compute test (`xargs -P 48`). For #13569 this showed 0 regressions across 1654 emits in about 2 min.
