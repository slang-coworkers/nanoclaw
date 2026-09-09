---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787691453370-7x6la5
written_at: 2026-08-25T21:08:09.803Z
---

# Partially-init entry-point output struct: unwritten field gets a spurious store (fix in glsl-legalize, not emit)

**Bug family (#12756; sibling #12653):** A vertex/fragment entry point returns an output struct where some fields are never written (`VOut o; o.color=...; return o;` with `o.uv` unwritten). The emitted SPIR-V/GLSL still stores an **undefined** value into the unwritten field's varying output. The varying stays correctly declared in the `OpEntryPoint` interface (Location N) — only the *store* is spurious.

**Root cause / correct fix layer:** `source/slang/slang-ir-glsl-legalize.cpp` — this is the SPIR-V *and* GLSL entry-point return→varying-output path (dispatched from `slang-emit.cpp:2209-2226`; `slang-ir-legalize-varying-params.cpp:943-949` explicitly *defers* varying structs here — that file is the CPU/CUDA path only). `rewriteReturnToOutputStore` (~:4652) replaces `return o` with `assign(resultGlobal, ScalarizedVal::value(returnValue))`; `assign` (~:2520) iterates **every** struct field (~:2590-2603) and `extractField` (~:2337-2343) does an **unconditional** `emitFieldExtract` + store (~:2561) with no "was this field written" check. The per-field output globals are created independently (~:2199-2244), so eliding a field's store keeps the varying declared. Fix belongs at this copy site (skip a field's store when its value is provably undefined), NOT in the emitter.

**Two gotchas that will bite you:**
1. **The undef arrives in TWO shapes.** Depending on SSA promotion, the unwritten field's value is either a `LoadFromUninitializedMemory` (→ `OpUndef` at `slang-emit-spirv.cpp:5531-5533`) OR a genuine `OpLoad` from an un-promoted `Function`-storage `OpVariable` that is never stored to. A fix that only checks for `IRUndefined` at emit misses the load-from-var shape. Peer through `FieldExtract`/load-of-uninitialized-var.
2. **The peephole comment lies.** `slang-ir-peephole.cpp:1994` deliberately preserves stores of `LoadFromUninitializedMemory` (so the uninitialized-use *diagnostic* checker can warn), with a comment claiming "on SPIR-V the backend re-elides it." That claim is **false** — `emitStore` (`slang-emit-spirv.cpp:8916-8949`) emits `OpStore` unconditionally, no undef guard. And DCE keeps it because a `kIROp_Store` is conservatively side-effecting (`slang-ir-dce.cpp:519-522`). So nothing downstream removes it.

**Test:** nearest existing test is `tests/language-feature/execution-model/vertex-return-struct-emission.slang` (the exact fully-initialized `VOut`/`vertMain` case) — add a partial-init variant there. Validate with `SLANG_RUN_SPIRV_VALIDATION=1` (a clean `slangc -target spirv-asm` exit does NOT run spirv-val).
