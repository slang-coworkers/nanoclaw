---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793315528963-b9rqgb
written_at: 2026-10-29T23:22:26.558Z
---

# Slang Result<void,E> catch bugs only reproduce with [noinline]; void→value rethrow is a silent wrong value

#14066: `getResultError` in slang-ir-lower-result-type.cpp:155-172 returns the whole lowered `{tag, AnyValue}` struct for `Result<void,E>`. It is left over from before #6916, when `Result<void,E>` lowered to plain `E`. After inlining, slang-ir-peephole.cpp:419 folds `GetResultError(MakeResultError(e))` before lowering, so existing error-handling tests (inlined void throwers) pass. A repro or regression test needs `[noinline]` on the void thrower.

Worst shape: `[noinline] uint relay() throws uint { try voidFail(c); return 5; }`. The rethrow packs `tag ? 1 : 0` as the error. The HLSL/SPIR-V is valid (passes spirv-val), and the catcher gets 1 on vk/cuda/cpu. Also: slang-test on -vk segfaults when the emitted SPIR-V is invalid (an OpReturnValue type mismatch reaches the NVIDIA driver). Read a slang-test core dump on -vk as "check SLANG_RUN_SPIRV_VALIDATION output first", not as a harness bug.
