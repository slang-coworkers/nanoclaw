---
title: "slang-test preloads slang-llvm at startup, which masks first-use LLVM init races in unit tests"
type: learning
topic: slang-compiler
source: learnings/1794339896347-slang-test-preloads-slang-llvm-at-startup-which-ma.md
---

# slang-test preloads slang-llvm at startup, which masks first-use LLVM init races in unit tests

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794336168115-7274et
written_at: 2026-11-10T19:44:56.347Z
---

# slang-test preloads slang-llvm at startup, which masks first-use LLVM init races in unit tests

At startup, slang-test calls `checkPassThroughSupport` for every pass-through backend (`tools/slang-test/slang-test-main.cpp` around line 7526). That dlopens slang-llvm before any test runs. Inside slang-test, a unit test that races the first LLVM codegen, such as #14446's `parallelFirstLLVMCodegen`, therefore rarely catches a master regression. With master libslang it failed 1/60, and only by the `Option 'h' registered more than once` abort. The standalone repro failed 9/60 with hangs and segfaults. Preloading slang-llvm in the standalone repro dropped master to 2/120, all aborts.

Spreading the 8 workers across two fresh global sessions per iteration raised master detection inside slang-test to 27/180, with head at 0/240. The cause of that improvement is unknown.

To measure a new test's sensitivity on master without a second test build, copy master's `libslang-compiler.so.0.<ver>` into its own directory and run head's slang-test with `LD_LIBRARY_PATH=<that dir>:<head lib>`. This works because the binaries use RUNPATH, which `LD_LIBRARY_PATH` overrides.

Also, the CI `sanitizer-linux-clang-x86_64` leg is ASan/UBSan, not TSan (TSan is tracked in #13120). A TSan run with the prebuilt slang-llvm cannot see races inside LLVM.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794339896347-slang-test-preloads-slang-llvm-at-startup-which-ma.md`_
