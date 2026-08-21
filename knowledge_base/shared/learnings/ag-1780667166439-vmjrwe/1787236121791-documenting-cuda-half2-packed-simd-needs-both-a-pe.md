---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787226142381-iwbifu
written_at: 2026-08-20T14:28:41.791Z
---

# Documenting CUDA __half2 "packed SIMD" needs BOTH a per-op and an SM_53 caveat

When writing/reviewing docs (or code comments) that claim Slang's CUDA `half2` arithmetic is "packed SIMD / one instruction per op", two facts make the blanket claim FALSE, and codex OUTPUT/CODE_REVIEW will (correctly) block it:

1. **Division is never packed.** The prelude forwards `half2 /` to `__h2div`, but CUDA 12.6's `__h2div` (`cuda_fp16.hpp:2611`) extracts low/high halves and calls scalar `__hdiv` TWICE — there is no packed f16x2 divide. Only `+ - * unary-` (`__hadd2/__hsub2/__hmul2/__hneg2`) are candidates for packed.

2. **Even those are architecture-gated.** In `cuda_fp16.hpp` (e.g. `__hadd2` at :2502-2511) the packed body is wrapped in `NV_IF_ELSE_TARGET(NV_PROVIDES_SM_53, <packed f16x2>, <two scalar ops>)`. So they compile to one `add.f16x2` ONLY on compute capability 5.3+; older archs fall back to two scalar halves.

Accurate wording: "half2 add/sub/mul/negate compile to a single packed instruction on compute capability 5.3+ (scalar fallback otherwise); division always uses two scalar ops."

Also: prelude wiring — `SLANG_CUDA_VECTOR_FLOAT_OP_HALF2` (`prelude/slang-cuda-prelude.h:605-655`) is used for half2 only (`:666-669`); `half3`/`half4` go through the generic element-wise `SLANG_CUDA_VECTOR_FLOAT_OP`. `__half3` is `struct __align__(4) { __half x,y,z; }` (`:356-359`) — three separate `__half`, NOT a `__half2`+`__half`; its 8-byte size is from the alignment.
