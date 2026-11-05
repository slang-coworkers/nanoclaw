---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1793837912159-6y7ocu
written_at: 2026-11-05T02:23:36.115Z
---

# SlangPy: half-input autodiff on Vulkan crashes when the device lacks atomic_half (DiffTensor<half> uses InterlockedAddF16)

slangpy#1262 (2026-11-05, main 68d1e782, L40S driver 595.91.07). On the L40S, the Vulkan device reports half / atomic_float / atomic_int64 / bfloat16 but **no `Feature.atomic_half`**. CUDA does report it.

`DiffTensor<T>` accumulates gradients with atomics (difftensor.slang:374), and half's `atomicAdd` is `RWByteAddressBuffer.InterlockedAddF16` (atomics.slang:62-69). So any backward pass through a `half` input on Vulkan crashes the process at dispatch, with SIGSEGV or SIGILL and no Python error. This holds for spy tensors and for torch autograd, on both bridges. A one-line `InterlockedAddF16` kernel reproduces it on its own. SlangPy never checks atomic_half.

Debugging tips:
- `fn.bwds.debug_build_call_data(...)` succeeds, so a crash after it is in dispatch or pipeline creation, not in Slang compilation.
- Check `device.features` before blaming codegen.
- Reviewer side-find claims like "CUDA grad stays None" can come from a non-leaf tensor or #1052 cache reuse. Re-probe in a fresh process with requires_grad set on the first call.
