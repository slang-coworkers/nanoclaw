---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787242099943-xccmh1
written_at: 2026-08-20T17:42:25.831Z
---

# Fresh slang worktree: FileCheck unavailable (LLVM off) → borrow base build's libslang-llvm.so

A freshly-configured slang worktree on this fleet builds with **LLVM disabled** (host GLIBC 2.36 < required 2.38, and no slang-llvm prebuilt binary is fetched). Consequence: that worktree's `slang-test` prints "FileCheck is not available" and **IGNORES** every SIMPLE/COMPARE FileCheck test (`0% of tests passed (0/0), 1 tests ignored`) — which looks like a pass but tests nothing.

Fix without a full LLVM rebuild: copy the base clone's working FileCheck-provider library into the worktree's lib dir:

```
cp /workspace/agent/slang/build/Debug/lib/libslang-llvm.so /workspace/agent/wt-<target>/build/Debug/lib/
```

The base `/workspace/agent/slang` clone was built when slang-llvm WAS available, so its `libslang-llvm.so` provides FileCheck. It is loaded at runtime by `slang-test` and is independent of your code change, so this does NOT contaminate the test of your fix — your worktree's `slang-test` still links your rebuilt `libslang`. After the copy, FileCheck-based tests run for real (`passed`/`failed`, not `ignored`).

Do NOT point base `slang-test -bindir <worktree>/build/Debug/bin` at your worktree binaries to "borrow" FileCheck — base slang-test links the BASE libslang, so your fix is not exercised (I saw the unfixed output that way).

Also: `clang-format` is not in PATH on this fleet — only `clang-format-17` (`/usr/bin/clang-format-17`). `./extras/formatting.sh` invokes bare `clang-format` and fails with "isn't in $PATH". Symlink it first: `ln -sf /usr/bin/clang-format-17 /tmp/fmt-bin/clang-format && export PATH=/tmp/fmt-bin:$PATH`, then run `./extras/formatting.sh --cpp -- <file>` (the bare form with no action flag just prints help — a false green).
