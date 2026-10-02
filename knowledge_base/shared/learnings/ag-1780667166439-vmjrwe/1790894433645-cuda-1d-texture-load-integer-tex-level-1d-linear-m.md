---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787171558661-q4gptw
written_at: 2026-10-01T22:40:33.645Z
---

# CUDA 1D texture Load: integer tex.level.1d = linear-memory TLD.1D; use tex.level.2d [x,0] for array-backed textures (slang#12630)

Use SASS to decide which PTX texture form to use, since no GPU is needed for that. In `nvcc -arch=sm_XX -cubin x.cu && cuobjdump -sass x.cubin | grep -E 'TLD|TEX'`, look at the dimension token at the end of each texture instruction.

What it showed for slang#12630 (nvcc 12.6; same on sm_52, 61, 70, 75, 80, 86, 89, 90):

| Source | SASS |
| --- | --- |
| integer `tex.level.1d.v4.f32.s32` | `TLD … 1D`, same opcode and dimension as `tex1Dfetch` (the linear-memory fetch) |
| CUDA's `tex1DLod<float4>` on a 1D texture object | `TEX … 2D` |
| `tex.level.2d…s32 [t,{x,0}]` | `TLD … 2D` |
| `tex.level.a1d…s32` | `TLD … ARRAY_1D` |

So for array-backed 1D CUtexObjects (all that slang-rhi creates), the integer fetch that matches is the 2D one at row 0. This is consistent with the L40S result, where `tex.level.1d…s32` returned all zeros.

Status: PR #13377, not yet runtime-verified. The T4 CUDA test in that PR checks the actual values.

Container gotchas from the same task:
- A GPU-less container with a stale CMake cache fails to link with `'/usr/lib/x86_64-linux-gnu/libcuda.so' missing`. Fix: reconfigure with `-DCUDA_cuda_driver_LIBRARY=/usr/local/cuda/lib64/stubs/libcuda.so`.
- The render-test CPU backend has no `Texture1D` subscript operator.
- The render-test CPU backend's integer texel unpackers cover only RGBA32Uint, R32Uint and R16Uint. There is no RGBA8Uint/Sint or RGBA32Sint, and the run produces empty output with no clear error. A `-cpu` reference line therefore has to use RGBA32Uint, and Sint coverage has to be CUDA-only.
- A bot workflow_dispatch of ci.yml can be blocked on two separate gates. One is `wait-for-human-priority` yielding. The other is the `falcor-ci` environment approval, which only ci-approvers can grant. `ci-retry-yielded-bot` only retries completed runs, so a run left `waiting` on falcor-ci never gets a CUDA result by itself.
