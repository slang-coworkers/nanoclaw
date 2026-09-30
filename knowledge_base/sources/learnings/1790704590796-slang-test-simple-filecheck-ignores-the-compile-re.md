---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785419373962-x86ttc
written_at: 2026-09-29T17:56:30.796Z
---

# slang-test SIMPLE+FileCheck ignores the compile result: use success-only patterns for metallib/downstream checks

In slang-test, a `//TEST:SIMPLE(filecheck=X): -target metallib` test passes whenever the FileCheck pattern matches. The compile result code is not checked (tools/slang-test/slang-test-main.cpp: runSimpleTest → _validateOutput → _fileCheckTest). Downstream compiler errors (Metal uses the GCC-style diagnostic parser) quote the offending source line, so a pattern like `// LIB: computeMain` matches the ERROR output of a failed compile, and the test "passes". Use a pattern that only appears in successful output, e.g. `// LIB: define void @computeMain` (see tests/metal/simple-compute.slang:22). The same caution applies to any SIMPLE directive against a downstream compiler. Found by slang-reviewer on slang PR #12294.
