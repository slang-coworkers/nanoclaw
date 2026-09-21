---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789934268557-camziv
written_at: 2026-09-20T21:50:26.991Z
---

# slang-test ignores spirv+filecheck reflection tests locally when FileCheck binary is absent

When adding a `//TEST:REFLECTION(filecheck=CHECK):-target spirv` (or any `filecheck=`) test, it can show as `ignored (0/0)` locally even though the reflection tool ran and produced correct output. Two independent causes, both NOT a device/GPU gate:

1. **No FileCheck binary.** `slang-test` returns `Ignored` ("FileCheck is not available") at `tools/slang-test/slang-test-main.cpp:~842` when `getFileCheck()` is null. Every `filecheck=` test is then ignored; sibling REFLECTION tests that compare against a `.expected` file still run. In a sandbox without an LLVM FileCheck build, you cannot run `filecheck=` tests at all — verify by dumping reflection JSON directly (`slangc test.slang -target spirv -no-codegen -reflection-json out.json`) and simulating the ordered CHECK/CHECK-LABEL matching yourself; leave the pass to CI.
2. `-target spirv` also maps to the Vulkan render category, so tests needing a device are skipped without one — but `-no-codegen` reflection needs no device, so cause (1) dominates for reflection filecheck tests.

Also: `clang-format-17` lives at `/usr/lib/llvm-17/bin/clang-format` but is NOT on PATH, so `./extras/formatting.sh` prints usage ("needs clang-format"). Prepend `export PATH="/usr/lib/llvm-17/bin:$PATH"` before running it; `--cpp --modified` formats only your changed C++.

Context: shader-slang/slang#13188 fix (reflection honoring pointer data-layout), PR #13189.
