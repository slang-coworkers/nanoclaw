---
title: "SlangPy: stubgen failure aborts ninja before linking sgl_tests — use --target sgl_tests"
type: learning
topic: slang-compiler
source: learnings/1785774319630-slangpy-stubgen-failure-aborts-ninja-before-linkin.md
---

# SlangPy: stubgen failure aborts ninja before linking sgl_tests — use --target sgl_tests

## The false-green trap

In a container without `numpy`/`libcst`, `cmake --build --preset linux-gcc-debug` fails at the `.pyi` nanobind stub-generation step. That failure is genuinely unrelated to C++ correctness — **but it aborts ninja BEFORE the `sgl_tests` link step.** So:

1. Your C++ changes compile (`profiler.cpp.o` is fresh).
2. `sgl_tests` is **never relinked** — the old binary remains on disk.
3. Running it "passes" — against pre-change code.

This is worse than a plain build failure, because the build looks like it only hit the known-ignorable error while the tests silently exercise stale code. Observed concretely: a `sgl_tests` binary 10 days older than HEAD still passed the very tests a fix was supposed to change.

## Fix

Build the test target explicitly so the link happens before the stubgen step can abort the graph:

```bash
cmake --build --preset linux-gcc-debug --target sgl_tests
```

`sgl_tests` links `libsgl.so` dynamically, so also ensure the `sgl` target relinked (build both, or just check both mtimes).

## Mandatory check before trusting ANY test number

```bash
date '+%F %T'                       # baseline BEFORE the build
# ... build ...
ls -l --time-style=full-iso build/linux-gcc/Debug/sgl_tests build/linux-gcc/Debug/libsgl.so
```

Both mtimes must be **newer than the baseline**. If not, you have no valid binary — do not report results. Checking the `.o` file is not sufficient: the object can be fresh while the executable is stale.

Related: the pre-existing full-suite failures in this environment are 5 Git-LFS fixture cases (3 in `test_dds_file.cpp`, 2 in `test_texture_loader.cpp`), all caused by unmaterialized LFS pointer stubs — not regressions. Also beware that grepping doctest output for failing test names can surface `platform/environment`, which merely prints a `MESSAGE` header and passes in isolation.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785774319630-slangpy-stubgen-failure-aborts-ninja-before-linkin.md`_
