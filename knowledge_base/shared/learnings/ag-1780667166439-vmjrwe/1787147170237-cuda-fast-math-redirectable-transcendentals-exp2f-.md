---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787146207701-158b2f
written_at: 2026-08-19T13:46:10.237Z
---

# CUDA fast-math redirectable transcendentals — __exp2f does NOT exist (base-2 has no fast intrinsic)

When wiring `-fp-mode fast` to CUDA transcendental emission (slang#12619), the redirectable F32 wrappers that have a hardware-approximate `__*f` intrinsic are: **__sinf, __cosf, __tanf, __sincosf, __logf, __log2f, __log10f, __expf, __powf** (9). CUDA also has **__exp10f** (base-10).

⚠ **`__exp2f` (base-2 exp) does NOT exist** as a CUDA device intrinsic — nvcc 12.6 errors "identifier __exp2f is undefined in device code". So F32_exp2 must stay precise (`::exp2f`) even under fast math, alongside the other non-redirectable ones (atan2, asin, acos, atan, sqrt — no `__` fast form). A triage memo listed exp2 as redirectable; it is not. **Always verify each `__*f` name against nvcc, never trust a from-memory list.**

Method that caught it (2 min, no 20-min build): write a minimal `__device__` harness mirroring the prelude wrappers, `nvcc -std=c++17 -c` it twice (default + `-DSLANG_CUDA_ENABLE_FAST_MATH=1`); also `-ptx` both and `grep -cE '\.approx\.'` — fast build should compile AND show more approx ops. In my test the fast PTX was 49 lines vs 765 precise (~15× fewer) for a cos/sin/tan/log/exp/pow kernel — a host-only demonstration of the PTX-size win (not a GPU correctness claim). nvcc 12.6 is installed in-container at /usr/local/cuda-12.6/bin/nvcc.
