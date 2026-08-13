---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786526527975-cn89lk
written_at: 2026-08-12T12:58:52.851Z
---

# slangi FieldExtract-on-pointer crashes emit-vm; MakeOptionalExpr must getSimpleVal its payload

shader-slang/slang#12495: `B b; Optional<A> o = b as A;` (struct B : A) SEGVs `slangi` (exit 139). Two durable lessons:

1. **A `slangi` segfault is often at BYTECODE-EMIT time, not VM execution.** The `ByteCodeEmitter` (`slang-emit-vm.cpp`) computes real byte offsets, so a malformed IR inst crashes there before any bytecode runs. Here `kIROp_FieldExtract` reached emit with a **pointer** base: `as<IRStructType>(base->getDataType())` → null → `findStructField(null,…)` → `getNaturalOffset(…,null,…)` null-derefs at `slang-ir-layout.cpp:592`. Localize with an `LD_PRELOAD` `SA_SIGINFO` SIGSEGV shim + `addr2line` (no gdb/lldb in the container); the shim's top frames + `si_addr` (0x30 = null+offset) pin the crash immediately.

2. **`FieldExtract` on a pointer base is emit-vm-specific fallout of a front-end lowering producer bug.** HLSL/C-like emit is textual (`base.field`) and tolerant, so `slangc -target hlsl` succeeds — the crash is interpreter-only. The `-validate-ir` verifier does NOT check that a `FieldExtract` base is a struct, and the typed `emitFieldExtract` overload (`slang-ir.cpp:5751`) doesn't assert it (only the 1-arg overload at :5735 does) — so the malformation flows to emit.

Root cause: `visitMakeOptionalExpr` (`slang-lower-to-ir.cpp:7029`) packed the payload with `emitMakeOptionalValue(optType, val.val)` — using `val.val` **directly**. For `b as A` the checker rewrites to `MakeOptionalExpr(CastToSuperTypeExpr(b,A))`; the base-subobject upcast lowers to a `Ptr`-flavored l-value (`extractField` `Flavor::Ptr` branch, :1169 → `emitFieldAddress` → `Ptr(%A)`). So the raw pointer became the Optional payload. Fix: `val.val` → `getSimpleVal(context, val)` (loads the Ptr flavor). Of the 3 `emitMakeOptionalValue` call sites in the lowerer only :7029 passed an unmaterialized `val.val`.

Method note: the malformed inst was present already at LOWER-TO-IR (grep `reinterpret` in the full `-dump-ir` = 0), which refuted a subagent's "a Reinterpret escapes a later lowering pass" hypothesis — **prefer the measured final IR over a plausible pass-ordering story.** Variant matrix pinned the trigger to base-subobject upcasts specifically: `A up=b; up as A` and same-type `A a; a as A` both work (their operands don't lower to a base-sub-object pointer). Fix at the r-value consumer, NOT in `extractField`/`emitCastToConcreteSuperTypeRec` — the `Ptr` flavor is intentional there for l-value consumers (assignment, out/inout).
