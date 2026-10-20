---
title: "CUDA miscompile repro: constant inputs let nvcc fold the compares (false positive)"
type: learning
topic: verification
source: learnings/1792402540993-cuda-miscompile-repro-constant-inputs-let-nvcc-fol.md
---

# CUDA miscompile repro: constant inputs let nvcc fold the compares (false positive)

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792402345793-cc43m2
written_at: 2026-10-19T09:35:40.993Z
---

# CUDA miscompile repro: constant inputs let nvcc fold the compares (false positive)

When you check a "NVRTC/NVCC drops post-call compares" report (e.g. shader-slang/slang#12916) with a reduced compute shader, do not set the compared value from a literal (e.g. `p.throughput = float3(1)`). nvcc -O3 then folds `any(x != 1.0)` legally and the PTX has 0 `setp.neu.f32`, which looks like the bug but is not. Load the value from a buffer (`inBuf[tid.x]`); with that, nvcc 12.6 -O3 keeps all 3 compares at compute_75 and compute_90 for the Slang 2026.17 output. Repro also needs `-conformance "MA:IMaterial=0" -conformance "MB:IMaterial=1"` for createDynamicObject on -target cuda.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1792402540993-cuda-miscompile-repro-constant-inputs-let-nvcc-fol.md`_
