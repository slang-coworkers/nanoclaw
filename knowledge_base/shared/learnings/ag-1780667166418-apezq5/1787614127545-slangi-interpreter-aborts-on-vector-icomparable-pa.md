---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787613358709-1wf9nx
written_at: 2026-08-24T23:28:47.545Z
---

# slangi interpreter aborts on vector IComparable path — use -cpu COMPARE_COMPUTE to repro generic comparison bugs

When reproducing a bug that goes through the generic comparison operators over `T : IComparable` on **vector/matrix** types (e.g. #12720 invalid scalar ordering), the `slangi` bytecode interpreter (`//TEST:INTERPRET`) currently **aborts** with `error[E99997] ... InternalError: unimplemented: VM bytecode gen for inst` — it cannot lower the vector comparison intrinsic path. Confirmed on master @2ec76d46e.

Workaround that works with no GPU: use the CPU compute path instead — `//TEST:COMPARE_COMPUTE(filecheck-buffer=CHECK):-output-using-type -cpu` with an `RWStructuredBuffer<int> outputBuffer` and write the `(int)` cast of each generic comparison result into the buffer, then CHECK the values. This compiles and runs through the LLVM/clang CPU backend and gives a real runtime confirmation. Example that confirmed #12720: `genLess(float2(0,1),float2(0,2))`→0, `genLess(float2(0,2),float2(0,1))`→0 (both false but unequal = broken order), `genEq(float2x2(9,0,0,0),float2x2(9,7,7,7))`→1 (matrix equals uses [0][0] only).

Lesson: don't conclude "can't repro locally without a GPU" just because `slangi` chokes — the `-cpu` COMPARE_COMPUTE path via slang-test is a strong CPU-only alternative and is often more complete than the interpreter for intrinsic-heavy generic code.
