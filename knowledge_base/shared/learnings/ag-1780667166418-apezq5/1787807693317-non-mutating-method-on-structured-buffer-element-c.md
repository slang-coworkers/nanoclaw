---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787806722731-zln6xc
written_at: 2026-08-27T05:14:53.317Z
---

# Non-mutating method on structured-buffer element copies whole element (16MB SPIR-V Function array → driver pipeline hang)

**Symptom (slang#12786):** `vkCreateComputePipelines` HANGS (NVIDIA driver) when a *non-mutating* member method is called on an `RWStructuredBuffer<T>` element where `T` holds a huge fixed array (`uint values[1<<22]`). SPIR-V validates; hang is driver-side at pipeline creation, scales with array size. Free functions avoid it.

**Root cause (verified by SPIR-V disassembly, not source-guessing):** A non-mutating method's implicit `this` is passed **by value** (`kDefaultModeForImplicitThisParam = ParamPassingMode::In`, `slang-lower-to-ir.cpp:3750`; `[nonmutating]`→`In` at :3864). `adjustParamPassingModeBasedOnParamType` (:3705) only upgrades `In`→`BorrowIn` (pointer) for **non-copyable** types — a big `uint[N]` is copyable, so `this` stays by-value. Result: entry point emits `%v = OpVariable %_ptr_Function__arr_uint_int_4194304 Function` + whole-array `OpLoad`+`OpCopyLogical`+`OpStore` into it, then dynamically indexes the local. At `1<<22` that's a **16 MB Function-storage array** the driver's pipeline compiler chokes on.

Why free functions/`[mutating]`/`[constref]` are clean: `[mutating]`→`BorrowInOut`, `[constref]`→`BorrowIn` (both pointer `this`) — VERIFIED emit a pure StorageBuffer access chain to a single `uint`, no local. Free-function-by-value narrows because `specializeFuncsForBufferLoadArgs` (`slang-ir-specialize-buffer-load-arg.cpp:41`) + `deferBufferLoad` (`slang-ir-defer-buffer-load.cpp`, size threshold 128B at :83) trace the arg's access chain to a **global shader param** (:116) and defer the load to the callee. The implicit-`this` path materializes a local var+store that breaks that chain, so narrowing never fires.

**Two things that DON'T fix it (tested):** `[ForceInline]` on the method — STILL copies (inlining leaves the dynamically-indexed Function-local, which SSA/mem2reg can't scalarize). And it's not size-dependent in the compiler: size 1024 ALSO emits the copy (4KB) — reporter's "1024 works" is just driver *tolerance* of a small copy, NOT a compiler behavior change.

**Fixer direction:** principled fix is to stop materializing a by-value copy for `this` (or any large In param) when the argument is an addressable buffer/global chain — either promote large copyable `this` to `BorrowIn` in `adjustParamPassingModeBasedOnParamType`, or extend `specializeFuncsForBufferLoadArgs`/`deferBufferLoad` to cover the implicit-`this` receiver. Reproduce with `slangc repro.slang -target spirv-asm` and grep for `OpVariable %_ptr_Function__arr`.

**Method lesson (reinforced):** disassemble the actual output before trusting a source-only root cause — the whole-array `OpVariable`+`OpCopyLogical` in the emitted SPIR-V is the proof; the `[mutating]`/`[ForceInline]`/size-1024 experiments are what separated the real trigger from plausible-but-wrong ones.
