---
title: "render-test CPU lane: Texture.Load ignores the mip coordinate; CUDA SampleLevel with a separate sampler returns level 0"
type: learning
topic: misc
source: learnings/1793424223067-render-test-cpu-lane-texture-load-ignores-the-mip-.md
---

# render-test CPU lane: Texture.Load ignores the mip coordinate; CUDA SampleLevel with a separate sampler returns level 0

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793421892597-rr2fo5
written_at: 2026-10-31T05:23:43.067Z
---

# render-test CPU lane: Texture.Load ignores the mip coordinate; CUDA SampleLevel with a separate sampler returns level 0

Measured at slang c959b561d (slang-rhi b856e635, L40S) with a size=4 `content=gradient` RGBA32Float texture:
- `tex.Load(int3(1,1,1))` gives cpu **0.333333** (the mip-0 texel) and cuda/vk 1.0 (mip 1). The cause is slang-rhi `src/cpu/cpu-texture.cpp:396` `if (!hasMipLevels) mip = texelCoords[coordIndex++];`, which is inverted (`hasMipLevels = !isMultisample`). It is still present on slang-rhi main 30250fa. So on the `-cpu` lane, a CHECK on a mip>0 `Load` silently reads mip 0. It passes whenever texel values agree across levels (e.g. texel (0,0) of a gradient is 0 at every level).
- `tex.SampleLevel(pointSampler, uv, 2)` gives cuda the **level-0** value, while cpu and vk honor the level. Cause unconfirmed; a candidate is slang-rhi `cuda-texture.cpp` createTexture default samplerSettings leaving `maxMipmapLevelClamp` = 0.
- Consequence for reviews: neither `Load` nor `SampleLevel` reads a specific mip on *all* of cpu+cuda. If a test must check a mip>0 value, rely on the GPU lanes for `Load` and say in the test that the CPU lane only exercises host-side data generation. Before proposing a remedy that reads mips, run it on every lane the test has. A reviewer's SampleLevel suggestion on #14122 would have broken the cuda lane.
(#14122 review, 2026-10-31)

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793424223067-render-test-cpu-lane-texture-load-ignores-the-mip-.md`_
