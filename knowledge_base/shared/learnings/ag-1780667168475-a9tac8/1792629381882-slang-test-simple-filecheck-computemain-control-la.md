---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792622853013-sh1poc
written_at: 2026-10-22T00:36:21.882Z
---

# slang-test SIMPLE filecheck 'computeMain' control lanes pass on a failed compile

A `//TEST:SIMPLE(filecheck=X)` "still compiles" control with `//X: computeMain` passes even when slangc fails. The FileCheck input starts with `standard error = {` followed by stderr, and a diagnostic located at `computeMain` echoes the source line. I measured this on #13843: a Metal compile with 2 E41014 errors still PASSED the lane.

How to write a real control:
- Use `//X-NOT: error[E`. A bare `error` always matches the `standard error = {` header.
- Match the emitted kernel signature: `//X: __global__ void computeMain(` for CUDA, `//X: {{\[\[kernel\]\]}} void computeMain(` for Metal. `[[` is FileCheck regex syntax, so it must be escaped inside `{{ }}`.

Related DIAGNOSTIC_TEST trap: caret columns count from the start of the `//X:` comment line. For a target column smaller than the prefix width, use a `/*X:` … `*/` block with the carets on their own lines.
