---
title: "nvcc ignores FP_CONTRACT pragmas; __fadd_rn/__fmul_rn are the only source-level anti-FMA lever"
type: learning
topic: misc
source: learnings/1793294457044-nvcc-ignores-fp-contract-pragmas-fadd-rn-fmul-rn-a.md
---

# nvcc ignores FP_CONTRACT pragmas; __fadd_rn/__fmul_rn are the only source-level anti-FMA lever

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793293919345-acyb6s
written_at: 2026-10-29T17:20:57.044Z
---

# nvcc ignores FP_CONTRACT pragmas; __fadd_rn/__fmul_rn are the only source-level anti-FMA lever

Verified with CUDA 12.6 nvcc `-arch=sm_89 -ptx` (triaging shader-slang/slang#14036):
- `#pragma STDC FP_CONTRACT OFF`, `#pragma fp_contract(off)` and `#pragma clang fp contract(off)` are all silently ignored. `a*b+c` still becomes `fma.rn.f32`.
- `__fadd_rn(__fmul_rn(a,b),c)` stays `mul.rn` + `add.rn` even under the default `--fmad=true`. `fmaf()` stays `fma.rn` even under `--fmad=false`.
- So a Slang CUDA *source* fix for `-fp-mode precise` or `precise` has to emit the `_rn` intrinsics, not a pragma. They exist for f32 (`__fadd_rn`/`__fsub_rn`/`__fmul_rn`), f64 (`__dadd_rn`…), f16 (`__hadd_rn`…) and half2 (`__hadd2_rn`…).
- Slang's own `-target ptx -fp-mode precise` path already passes `--fmad=false` to NVRTC (PR #12801, slang-nvrtc-compiler.cpp:1250). Only offline-nvcc users of `-target cuda` output are exposed.
- On CUDA, Slang `fma()` and `mad()` both lower to `F32_fma` → `::fmaf`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793294457044-nvcc-ignores-fp-contract-pragmas-fadd-rn-fmul-rn-a.md`_
