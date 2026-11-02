---
title: "Slang CUDA: -Xnvrtc --maxrregcount is a no-op on PTX output; use __launch_bounds__/__maxnreg__ (mutually exclusive)"
type: learning
topic: slang-compiler
source: learnings/1793543915235-slang-cuda-xnvrtc-maxrregcount-is-a-no-op-on-ptx-o.md
---

# Slang CUDA: -Xnvrtc --maxrregcount is a no-op on PTX output; use __launch_bounds__/__maxnreg__ (mutually exclusive)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793543442503-dh45xo
written_at: 2026-11-01T14:38:35.235Z
---

# Slang CUDA: -Xnvrtc --maxrregcount is a no-op on PTX output; use __launch_bounds__/__maxnreg__ (mutually exclusive)

Measured 2026-11-01 (#14135, L40S sm_89, CUDA/NVRTC 12.6.85, slang master 6815ed82d):
- `slangc -target ptx -Xnvrtc --maxrregcount=64` DOES reach nvrtcCompileProgram (a bogus `-Xnvrtc` option gets "unrecognized option" from NVRTC). But it has NO effect. Slang asks NVRTC for PTX (`-arch=compute_XX`), and `--maxrregcount` only applies when SASS is generated. A 96-accumulator test kernel stays at 80 regs, and the PTX has no `.maxnreg`. With direct NVRTC `-arch=sm_89 --maxrregcount=64` (cubin), it drops to 64 regs. For Slang-driven PTX, the only per-kernel control is a source qualifier in the .cu.
- Hand-inserted `__launch_bounds__(128, 8)` or `__maxnreg__(64)` both give 64 regs. They appear in the PTX as `.maxntid 128, 1, 1` + `.minnctapersm 8`, or `.maxnreg 64`, so the driver JIT honours them.
- nvcc accepts both placements: `__global__ void __launch_bounds__(..) name` and `__launch_bounds__(..) __global__ void name`.
- `__launch_bounds__` and `__maxnreg__` on the SAME kernel is a hard nvcc/NVRTC error: "The __launch_bounds__ and __maxnreg__ qualifiers cannot be applied to the same kernel". `__maxnreg__` is CUDA 12.4+ (12.4 release notes).
- If maxThreads×minBlocks is more than the SM thread limit (e.g. (256, 8) on sm_89 = 2048 > 1536), ptxas only warns ".minnctapersm will be ignored".
- Slang attribute use sites do NOT accept named args: `[numthreads(x: 64)]` gives E20001.
Re-measure by sed-inserting the qualifier after `extern "C" __global__ void` in slangc's .cu, then run `nvcc -c -arch=sm_89 -I<slang>/prelude -Xptxas -v`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793543915235-slang-cuda-xnvrtc-maxrregcount-is-a-no-op-on-ptx-o.md`_
