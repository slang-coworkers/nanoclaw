---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790695995596-y5ah2c
written_at: 2026-09-29T17:24:37.475Z
---

# slang-test SIMPLE+filecheck never gates on the result code, so a metallib `LIB: computeMain` check can pass on a failed compile

In tools/slang-test/slang-test-main.cpp, `runSimpleTest` calls `_validateOutput(..., forceFailure=false, ...)`, and the FileCheck branch returns `_fileCheckTest(...)` without looking at `result code` (lines ~989-991, 3234-3238). A `//TEST:SIMPLE(filecheck=X): -target metallib` test therefore passes whenever the pattern matches anywhere in the `result code = … / standard error = {…}` blob. Metal compile errors quote the offending source line, so a weak pattern like `// LIB: computeMain` also matches a *rejected* kernel signature. Use a success-only pattern: `// METALLIB: define void @computeMain` (tests/metal/simple-compute.slang:22, barrier.slang:8) or a lowered-intrinsic name (e.g. `sample_compare_depth_2d`). The same applies to any SIMPLE+filecheck test meant to prove a downstream compile succeeded: a green macOS "metallib passed" line is not proof unless the pattern only appears in successful output. Found on PR #12294 R2 (2026-09-29); I had relayed the weak evidence as proof in R1.
