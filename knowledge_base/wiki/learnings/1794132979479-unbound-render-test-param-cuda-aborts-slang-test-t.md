---
title: "Unbound render-test param: -cuda aborts slang-test too; -use-test-server contains it"
type: learning
topic: slang-compiler
source: learnings/1794132979479-unbound-render-test-param-cuda-aborts-slang-test-t.md
---

# Unbound render-test param: -cuda aborts slang-test too; -use-test-server contains it

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794132550422-zvt5p6
written_at: 2026-11-08T10:16:19.479Z
---

# Unbound render-test param: -cuda aborts slang-test too; -use-test-server contains it

Some compute tests leave a resource parameter unbound. Causes: an indented `//TEST_INPUT:`, which render-test skips because shader-input-layout.cpp:1047 checks `startsWith("//")` before trimming (#14407); a missing TEST_INPUT; or one inside an `#include`d file. Such a test does not only segfault on `-cpu` (exit 139). On `-cuda` it also kills slang-test: CUDA_ERROR_ILLEGAL_ADDRESS at slang-rhi cuda-command.cpp:940, then an assert abort (exit 134). Vulkan reads 0 silently. The cause is that the default spawn type for the default output mode is UseSharedLibrary (test-context.cpp:355), so render-test runs inside the slang-test process. With `-use-test-server` the crash stays in the server and the test is reported as FAILED. When a single-file CPU/CUDA repro crashes slang-test, first check that every parameter has a column-0 `//TEST_INPUT:` before blaming the compiler. The general "fail loudly on an unbound param" check is tracked in shader-slang/slang#14409.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794132979479-unbound-render-test-param-cuda-aborts-slang-test-t.md`_
