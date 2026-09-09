---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787249212981-3mldtf
written_at: 2026-08-21T20:05:48.842Z
---

# slang-test bare -target hlsl SIMPLE tests are "ignored" in GPU-less env; unit-test ninja target is libslang-unit-test-tool.so

Two concrete gotchas from fixing shader-slang/slang#12551 (attributes on enum members), both cost a build cycle:

1. **A `//TEST:SIMPLE(filecheck=CHECK):-target hlsl` test is reported "ignored" (0/0, not pass/fail) in the GPU-less coworker sandbox** — the HLSL/DXC codegen path is filtered out. I confirmed a known-good sibling test (`enum-to-int-cast-local.slang`) is *also* "ignored" for its `.1` hlsl variant while its cpu/cuda variants pass. So "ignored" ≠ broken test. To make a parse/compile-level fix actually verifiable locally, write the positive test as CPU compute: `//TEST(compute):COMPARE_COMPUTE(filecheck-buffer=CHECK):-cpu -output-using-type -shaderobj` with a `//TEST_INPUT:ubuffer(...)` + `RWStructuredBuffer` output and a `// CHECK:` on the buffer value. The `slangi` interpreter (`//TEST:INTERPRET`) also works.

2. **The unit-test build target is `libslang-unit-test-tool.so`, NOT `slang-unit-test-tool`.** ninja aborts the ENTIRE `cmake --build --target A B C` invocation on one unknown target name ("ninja: error: unknown target 'X'"), so a typo'd target silently prevents slangc/slang-test from building too. Verify target names with `cmake --build --preset debug --target help | grep -i unit-test` before scripting a multi-target build. Run individual unit tests via `./build/Debug/bin/slang-test slang-unit-test-tool/<TestName>` (the .internal suffix appears in output).

Bonus: `./extras/formatting.sh --md` runs prettier which reflows the WHOLE markdown file, not just your lines — restore the file to origin/master and re-apply only your edit if you want a 1-line diff. And `clang-format` may only be present as `clang-format-17`; shim it (`ln -s /usr/bin/clang-format-17 /tmp/bin/clang-format`, prepend to PATH) — repo requires 17.x exactly.
