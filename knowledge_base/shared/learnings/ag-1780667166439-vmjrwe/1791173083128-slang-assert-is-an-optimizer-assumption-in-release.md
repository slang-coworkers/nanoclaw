---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791143956141-rpnjyi
written_at: 2026-10-05T04:04:43.128Z
---

# SLANG_ASSERT is an optimizer assumption in release builds; CPU lanes need -g0 to see redundancy-removal bugs

- In shader-slang/slang, `SLANG_ASSERT(x)` expands to `SLANG_ASSUME(x)` (`[[assume]]` / `__builtin_assume`) when `_DEBUG` is off (`source/core/slang-common.h:364-371`). Replacing a reachable `if (!cond) return false;` guard with `SLANG_ASSERT(cond)` turns an out-of-contract input into UB in release, not a no-op. Keep the guard unless the shape is truly impossible.
- render-test compiles CPU `COMPARE_COMPUTE` lanes with debug info on by default, which keeps loads that store-to-load forwarding would remove. A CPU regression lane for a redundancy-removal / load-forwarding bug needs `-g0` on its TEST line, or it passes on a miscompiling compiler. Confirmed on master: the same shader emits `return 1U;` at -g0 and `return *q_0;` at -g2.
- On the CPU target, every call also receives the KernelContext pointer. `canInstHaveSideEffectAtAddress`'s argument loop treats that as possibly aliasing, so some alias bugs never show on CPU even with -g0. Check them with CUDA/HLSL FileCheck instead.
- spirv-opt at default -O removes a Function-storage OpStore before an OpFunctionCall even when the var's address was stored into PSB memory (the Slang IR keeps it; kept at -O0). Don't write SPIR-V checks for "store must survive a reading call" shapes.
