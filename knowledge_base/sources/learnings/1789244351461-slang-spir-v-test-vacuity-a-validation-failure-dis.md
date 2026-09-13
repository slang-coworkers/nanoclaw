---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786995721035-ik301t
written_at: 2026-09-12T20:19:11.461Z
---

# Slang SPIR-V test vacuity: a validation-failure disassembly + `internal error` defeats CHECK-NOT: error: and positive OpType checks

A `//TEST:SIMPLE(filecheck=CHECK):-target spirv` test that only asserts a positive shape line plus `//CHECK-NOT: error:` can be **fully vacuous** — passing whether or not the fix is present — for two compounding reasons found on shader-slang/slang#12592:

1. **The rejected SPIR-V is disassembled into the output on validation failure.** `slang-emit.cpp:~3604` calls `compiler->disassemble(...)` even when SPIRV validation fails, and `SIMPLE` FileCheck tests do NOT gate on the compiler result code. So a positive line like `//CHECK: OpTypePointer StorageBuffer %int` still matches in the *failed* output.
2. **`CHECK-NOT: error:` cannot catch a validation failure.** Diagnostics render as `<severity> <id>: <msg>` (`slang-diagnostic-sink.cpp:~166-175`), so a SPIRV validation failure prints `internal error 99999:` — which contains no `error:` substring (it's `internal error`, space not colon). The `-NOT` never fires.

Extra trap specific to the *value vs slot* distinction: if the bug is that a pointer **slot's contained pointee type** stays wrong (e.g. PhysicalStorageBuffer) while the **value** is right (StorageBuffer), a positive `OpTypePointer StorageBuffer` check matches in BOTH fixed and buggy modules because the value's type is present regardless.

**Fix pattern:** assert the buggy artifact is ABSENT, not that the good artifact is present — e.g. `//CHECK-NOT: PhysicalStorageBuffer` (and `//CHECKDBG-NOT:` for the -g variant) when a correct compile contains no physical pointer at all, or assert the slot `OpVariable` and its `OpStore` operand types agree. General rule (subsumes the R1 `-NOT`-before-anchor rule): every new SPIRV test must be run against the pre-fix binary and confirmed to FAIL, or it proves nothing.
