---
title: "Local UBSan repro of slang CI sanitizer findings: use gcc + -fsanitize=float-cast-overflow on all targets; clang 14 and gcc ASan fail"
type: learning
topic: slang-compiler
source: learnings/1793424217444-local-ubsan-repro-of-slang-ci-sanitizer-findings-u.md
---

# Local UBSan repro of slang CI sanitizer findings: use gcc + -fsanitize=float-cast-overflow on all targets; clang 14 and gcc ASan fail

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793421892597-rr2fo5
written_at: 2026-10-31T05:23:37.444Z
---

# Local UBSan repro of slang CI sanitizer findings: use gcc + -fsanitize=float-cast-overflow on all targets; clang 14 and gcc ASan fail

In the coworker container (Debian 12, gcc 12.2, clang 14.0.6):
- **clang 14 cannot compile current slang master.** `source/core/slang-internally-linked-list.h:122` needs C++20 relaxed `typename` (clang ≥16). CI's sanitizer job uses clang-18, so its `SLANG_ENABLE_ASAN=ON` config can't be replicated locally with clang.
- **gcc `-fsanitize=undefined` does NOT include `float-cast-overflow`** (clang's does). So a gcc `SLANG_ENABLE_ASAN=ON` build misses NaN/inf→int findings such as #14121.
- **gcc + `SLANG_ENABLE_ASAN=ON` hung:** `slang-embed` (generators) ran at 99% CPU for 15+ min on the prelude headers and had to be killed.
- **What worked (~10 min at -j60):** `CC=gcc CXX=g++ cmake --preset default -B build-ub -DSLANG_ENABLE_DXIL=OFF -DSLANG_ENABLE_EXAMPLES=OFF -DCMAKE_{C,CXX,EXE_LINKER,SHARED_LINKER,MODULE_LINKER}_FLAGS=-fsanitize=float-cast-overflow`, then `cmake --build build-ub --config Release --target slangc slang-test render-test test-server`. Run with `UBSAN_OPTIONS=print_stacktrace=1:halt_on_error=0:log_path=/tmp/x/ubsan`. A clean run writes no files; confirm the instrumentation is live with a revert drill (revert the fix, rebuild `render-test` only, rerun). Copy `libslang-llvm.so` into `build-ub/Release/lib` or the filecheck rows are ignored.
- The render-test library target is `render-test` (it produces `librender-test-tool.so`), not `render-test-tool`.
(#14122 review, 2026-10-31)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793424217444-local-ubsan-repro-of-slang-ci-sanitizer-findings-u.md`_
