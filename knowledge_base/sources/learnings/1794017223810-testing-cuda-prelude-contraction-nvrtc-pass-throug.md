---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794010689277-2rqq4g
written_at: 2026-11-07T02:07:03.810Z
---

# Testing CUDA prelude contraction: NVRTC pass-through PTX lane + traps (quoted #include A/B, unrounded PTX, bf16 sm_80, clang-format on .cu)

From shader-slang/slang#14036 (CUDA -fp-mode precise → _rn intrinsics):

- **A slang-test lane that actually compiles prelude #if bodies AND has teeth:** a `.cu` fixture under tests/cuda with `//TEST:SIMPLE(filecheck=CHECK): -pass-through nvrtc -target ptx -entry <kernel> -capability cuda_sm_9_0 -I prelude` (`#define` the gate + `#include "slang-cuda-prelude.h"`). It runs through NVRTC WITHOUT `-fp-mode`, so NVRTC keeps `--fmad=true` (a `-target ptx -fp-mode precise` lane has no teeth: NVRTC already gets `--fmad=false`, and `-Xnvrtc --fmad=true` errors "defined more than once"). All `extern "C" __global__` kernels land in the PTX, entries in source order.
- **Checking only `fma.rn` is not enough:** PTX `mul.f32`/`add.f32` WITHOUT a rounding modifier are still contractable by ptxas (and NVVM leaves them unfused when the product has 2 uses). Contraction-proof = every float op is `.rn`; use a NOT on `{{(mul|add|sub)\.(f16|f32|f64|bf16)}}`. CHECK-NOT between CHECK-DAG groups leaves gaps — use a second prefix whose NOT spans everything before a final control kernel.
- **A/B trap:** `#include "slang-cuda-prelude.h"` (quotes) searches the including file's directory FIRST, so `nvcc -I oldprelude x.cu` silently uses a prelude copy sitting next to `x.cu`. Put the A/B source in a dir with no prelude copy, or you'll "prove" no difference.
- **bf16 below sm_90:** CUDA implements bf16 mul/add (both `__hmul2` and `__hmul2_rn`) as `fma.rn.bf16x2 d,a,b,c` with c=0x80008000 (−0.0) — one rounding, not a contraction; distinct `mul.bf16x2` vs `mul.rn.bf16x2` exist only from sm_90, so bf16 checks need an sm_90 lane. Half/bf16 `_rn` intrinsics need CUDA ≥ 11.8.
- **Don't clang-format `.cu` test files by hand:** `extras/formatting.sh` doesn't cover `*.cu`, and clang-format re-wraps `//TEST:` directives into `// TEST:` + broken lines → "result code = -1".
- WmmaFragment (CoopMat) element-wise ops in the Load→a*b+c→Store shape emit unrounded `mul.f32`/`mul.f16x2` on master — they need the same treatment as vector/matrix operators.
