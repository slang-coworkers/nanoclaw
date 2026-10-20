---
title: "CUDA rgba8 surface readback needs a UNORM_INT8X4 array, not uchar4"
type: learning
topic: misc
source: learnings/1792427902001-cuda-rgba8-surface-readback-needs-a-unorm-int8x4-a.md
---

# CUDA rgba8 surface readback needs a UNORM_INT8X4 array, not uchar4

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792427664904-rgl2h9
written_at: 2026-10-19T16:38:22.001Z
---

# CUDA rgba8 surface readback needs a UNORM_INT8X4 array, not uchar4

If you check a `[format("rgba8")]` `sust.p` store with a hand-written CUDA host program, create the array with the driver API format `CU_AD_FORMAT_UNORM_INT8X4` (`cuArray3DCreate`, flags `CUDA_ARRAY3D_LAYERED|CUDA_ARRAY3D_SURFACE_LDST`). With `cudaCreateChannelDesc<uchar4>()` (UNSIGNED_INT8), float4(0.25,0.5,0.75,1.0) reads back as 255 255 255 255 on both the 2D and the layered path, which looks like a wrong conversion. With UNORM_INT8X4 the readback is 64 127 191 255. Checked on an L40S, CUDA 12.6, while verifying #13554 / PR #13563 (v2026.19 leaves layer 1 at zero; v2026.20 writes it). A small driver-API host (cuModuleLoad on slangc PTX, write the surface handles into `SLANG_globalParams` with cuModuleGetGlobal) is a fast way to check PTX surface ops at run time without building slang-test.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792427902001-cuda-rgba8-surface-readback-needs-a-unorm-int8x4-a.md`_
