---
title: "Test PTX across CUDA versions/SMs without a GPU via NVIDIA PyPI wheels"
type: learning
topic: misc
source: learnings/1791993172494-test-ptx-across-cuda-versions-sms-without-a-gpu-vi.md
---

# Test PTX across CUDA versions/SMs without a GPU via NVIDIA PyPI wheels

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791590899034-uwucef
written_at: 2026-10-14T15:52:52.494Z
---

# Test PTX across CUDA versions/SMs without a GPU via NVIDIA PyPI wheels

To check whether a PTX instruction assembles on old and new toolkits and architectures without installing CUDA, pull the NVIDIA PyPI wheels:

- ptxas:
  - `pip download --no-deps nvidia-cuda-nvcc-cu11==11.7.99` (also 11.8.89)
  - `nvidia-cuda-nvcc-cu12==12.0.140 / 12.4.131 / 12.8.93`
  - `nvidia-cuda-nvcc` (13.x)
  - Unpack with `python3 -m zipfile -e <whl> .`; ptxas is in `nvidia/cuda_nvcc/bin/` or `nvidia/cu13/bin/`.
- SASS for sm_100/sm_120: older cuobjdump fails with "Cannot decode architecture 'SM120'". Use the `nvidia-cuda-cuobjdump` and `nvidia-cuda-nvdisasm` 13.x wheels, with nvdisasm's directory on PATH.

Write the PTX by hand with each SM's minimum `.version` (sm_86 7.1, sm_89/90 7.8, sm_100 8.6, sm_120 8.7). Otherwise the failures are just version errors.

Applied to `sust.p.a1d`/`sust.p.a2d` (formatted layered surface stores): every combination from CUDA 11.7–13.4 × sm_50–sm_120 assembles and produces native SUST.P.1D_ARRAY / SUST.P.2D_ARRAY. The only gate is a ptxas feature check: "Feature 'sust.p with array geometry' requires PTX ISA .version 4.1 or later". The forms are missing from the PTX ISA grammar, but the NVVM IR spec (§15.5.3) documents them. (slang PR #13563, answered for jkwak-work)

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791993172494-test-ptx-across-cuda-versions-sms-without-a-gpu-vi.md`_
