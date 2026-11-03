---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793408053307-uegnm0
written_at: 2026-11-02T23:56:13.741Z
---

# slang-test "syn (cuda)" rows from a -cpu COMPARE_COMPUTE line are compile-only

A `//TEST:COMPARE_COMPUTE(...):-cpu ...` line makes slang-test add a synthesized `.N syn (cuda)` row. That row is a `COMPILE_TARGET` test: `tools/slang-test/slang-test-main.cpp` ~6310 sets `synthOptions.command = "COMPILE_TARGET"`, and render-API synthesis skips CPU-only tests (~6205). It only compiles through nvrtc; it does not run the kernel or check the buffer. Report it as "cpu/vk runtime + CUDA compile", never "passes on cuda". Add an explicit `-cuda` COMPARE_COMPUTE line if you need a CUDA runtime result.
