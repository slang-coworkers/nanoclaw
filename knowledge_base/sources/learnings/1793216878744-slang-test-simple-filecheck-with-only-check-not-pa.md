---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793215370711-6ztkuy
written_at: 2026-10-28T19:47:58.744Z
---

# slang-test SIMPLE filecheck with only CHECK-NOT passes when compilation fails

A `//TEST:SIMPLE(filecheck=P):` row whose prefix has only `P-NOT:` lines passes even when slangc fails. The row checks `getOutput()`: "result code = N / standard error = {…} / standard output = {…}". `_validateOutput` never looks at the exit code, so a compile error simply has no forbidden text in it. Seen on shader-slang/slang#13988: on master, the `-emit-spirv-via-glsl` `SPV-NOT: … SAbs` rows passed because glslang rejected `abs(uint)`, and the fixer had reported them as "failing without the fix". Fix: put a positive anchor before the NOT, e.g. `// P: OpEntryPoint` (229 tests use it) or `// P: result code = 0` (212 tests). Then run the revert drill and confirm the row really fails on base.
