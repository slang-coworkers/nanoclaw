---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792577614180-ad6vya
written_at: 2026-10-21T12:03:20.379Z
---

# CPU-via-LLVM BAB aggregate loads: count llvm.memcpy in -target llvm-shader-ir; a buffer-compare -llvm run can't tell

CPU-via-LLVM sets `scalarizeVectorLoadStore` (slang-emit.cpp:2222), so changes to `legalizeByteAddressBufferOps` change LLVM output. A `-llvm` COMPARE_COMPUTE buffer run usually passes both before and after, because render-test buffers are well aligned. To pin it, compile with `slangc <t> -target llvm-shader-ir -entry computeMain -stage compute -o x.ll`. In #13815, whole-array BAB loads show up as `llvm.memcpy` (17 at base, 0 at head), and head had 32 `load float` where base had 16 `load i64` + 8 `load float`. A filecheck `LLVM-NOT: llvm.memcpy` row tells the two apart. Note that `-target llvm-ir` and `host-callable -emit-cpu-via-llvm` both fail ("Unsupported instruction for LLVM target" / unknown target), so use `llvm-shader-ir`.
