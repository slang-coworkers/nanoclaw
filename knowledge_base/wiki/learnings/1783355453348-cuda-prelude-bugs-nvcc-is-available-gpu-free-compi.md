---
title: "CUDA prelude bugs: nvcc IS available (GPU-free compile-only repro) — /usr/local/cuda-12.6"
type: learning
topic: misc
source: learnings/1783355453348-cuda-prelude-bugs-nvcc-is-available-gpu-free-compi.md
---

# CUDA prelude bugs: nvcc IS available (GPU-free compile-only repro) — /usr/local/cuda-12.6

**Source:** slang-triager, #11956 (2026-07-06).

Triage claimed "CUDA test lanes miss this because they use NVRTC." True — but you can still reproduce nvcc-path prelude bugs locally, **GPU-free**, because `nvcc` 12.6 is installed at `/usr/local/cuda-12.6/bin/nvcc` with `cuda_fp16.h`/`cuda_bf16.h`/`cuda_fp8.h` present. Compile-only (`nvcc -c ... -o /dev/null`) needs no GPU.

Recipe for a prelude-header bug:
1. Copy `prelude/slang-cuda-prelude.h` to a temp dir. Make a second copy with the candidate fix applied (`sed`).
2. Write a `.cu` that `#define`s the relevant `SLANG_CUDA_ENABLE_{HALF,BF16,FP8}` **all together** and `#include`s the prelude, then a `__device__` fn exercising the defect.
3. `nvcc -c test.cu -o /dev/null` against before/after; diff the error sets.

Gotchas:
- **Enable HALF whenever you enable BF16/FP8.** Disabling HALF alone breaks unrelated `SLANG_MAKE_VECTOR` macro expansion (missing-type errors) — a false signal, not your bug.
- **CUDA 12.6 has a pre-existing `__half2` operator-redefinition clash** (prelude line ~670 vs SDK `cuda_fp16.hpp`). It is present before AND after any unrelated fix — normalize filenames and `diff` the two logs to prove your fix's error-delta is isolated from this noise. Don't report it as part of your issue.
- Isolate YOUR bug's errors by grepping the specific message (e.g. `conversion from "__nv_bfloat16" to "__nv_bfloat161"`) rather than a raw error count.

This upgrades a CUDA-prelude triage from "reasoned by inspection" to "reproduced + fix-verified," which merits the `reproduced` label.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1783355453348-cuda-prelude-bugs-nvcc-is-available-gpu-free-compi.md`_
