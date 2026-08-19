---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787061271900-x1eexw
written_at: 2026-08-18T14:12:49.766Z
---

# AnyValue marshalling emits field-wise bit_cast per 4 bytes (CUDA/CPP code-size)

shader-slang/slang#12606: dynamic dispatch through a runtime existential boxes each conforming type into a flat `AnyValueN` struct whose `packAnyValue`/`unpackAnyValue` functions copy ONE 4-byte word at a time via `slang_bit_cast<uint>` — ~33 statements/def, ~90 emitted CUDA lines per (pack+unpack) pair. On the reporter's autodiff repro at n=32 this is 2880 of 12005 emitted lines = 24%.

Root cause (all `source/slang/slang-ir-any-value-marshalling.cpp`): `ensureAnyValueType` (L83) models the payload as a flat array of `(N+3)/4` `uint` fields; `emitMarshallingCode` (L165) recurses struct/vector/matrix to each LEAF scalar and `marshalBasicType` (L356 pack / L778 unpack) emits a per-leaf load→`emitBitCast(uint)`→`emitFieldAddress`→store. There is NO whole-object memcpy/reinterpret path. Dedup is keyed by `{originalType, anyValueSize}` (`MarshallingFunctionKey` L60-72) — so two BYTE-IDENTICAL types each get their own pack+unpack pair (no layout-based sharing); funcs also get no linkage (L736-739) so they duplicate across modules.

Autodiff amplifies it: reverse-mode's per-method backward-context structs (`s_bwdCallableCtx_*`, built in `slang-ir-autodiff-unzip.cpp:947`) are boxed through this SAME path when a `[Differentiable]` method is dispatched via an existential — so the biggest AnyValue size classes (44/48 in production shaders) are compiler-generated context structs, not user `[anyValueSize(N)]` payload.

Two gotchas for anyone triaging/fixing:
1. The emitter is a FAITHFUL PRINTER — `kIROp_BitCast`→`slang_bit_cast<T>()` at `slang-emit-cpp.cpp:1812`; CUDA has no override; `slang_bit_cast` = pointer reinterpret (`prelude/slang-cuda-prelude.h:4332`). The fix belongs in the IR pass, not emit. CUDA & CPP share ONE emitter (`CUDASourceEmitter : CPPSourceEmitter`, `slang-emit-cuda.h:44`) — any change affects `-target cpp` too.
2. #12459 ("Lower singleton optional payloads directly", merged 2026-08-15) is COMPLEMENTARY and does NOT fix this — it collapsed the single-conformer case to `(ConcreteType, uint)`; #12606 is the multi-conformer case where AnyValue is unavoidable. Verified by re-running the repro on 2026.13.1-50-g3649fb982 (post-#12459) — line counts unchanged. The whole thing is GPU-free (`slangc -target cuda … -o out.cu`), so it's locally reproducible without a GPU.

Field-wise (not memcpy) is deliberate for correctness: non-uniform field sizes, bool 0/1 normalization, sub-word (half/int8) bit packing, 64-bit lo/hi split, pointer→uint2, Metal DescriptorHandle casts, and strict-aliasing safety. A bulk-copy fast path must PROVE byte-compatibility and fall back to field-wise otherwise.
