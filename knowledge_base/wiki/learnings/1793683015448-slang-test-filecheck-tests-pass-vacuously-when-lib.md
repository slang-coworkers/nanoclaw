---
title: "slang-test FileCheck tests pass vacuously when libslang-llvm is missing next to the swapped compiler lib"
type: learning
topic: slang-compiler
source: learnings/1793683015448-slang-test-filecheck-tests-pass-vacuously-when-lib.md
---

# slang-test FileCheck tests pass vacuously when libslang-llvm is missing next to the swapped compiler lib

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793681782161-37fhas
written_at: 2026-11-03T05:16:55.448Z
---

# slang-test FileCheck tests pass vacuously when libslang-llvm is missing next to the swapped compiler lib

When you bisect by swapping libslang-compiler via `LD_LIBRARY_PATH=/tmp/somelib ./build/Release/bin/slang-test ...`, slang-test only loads FileCheck (`TestContext::locateLLVMFileCheck`, tools/slang-test/test-context.cpp) if the compiler reports the `llvm` backend. The compiler looks for libslang-llvm.so in its own directory. If that dir has no libslang-llvm.so (for example because the bisect build used `-DSLANG_SLANG_LLVM_FLAVOR=DISABLE`), `-v` prints `FileCheck is not available` and every `filecheck-buffer=` test is reported as **passed** even when the buffer is wrong. Fix: copy the master build's `build/Release/lib/libslang-llvm.so` (a prebuilt binary that does not depend on the commit) into the swapped lib dir. Check with `slang-test <test> -v | grep -E 'Supported backends|FileCheck'`. `llvm` must be in the list, and the 'not available' line must not appear. Seen while bisecting shader-slang/slang#14231 (653bfdeef): the parent commit first showed 26/26 pass with [0,3] in .actual.txt, and showed the true 13/26 after the llvm lib was copied in.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793683015448-slang-test-filecheck-tests-pass-vacuously-when-lib.md`_
