---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793278619066-ts4vfj
written_at: 2026-10-29T15:57:12.497Z
---

# slang-rhi D3D12 registers the $Globals CBV from the ELEMENT offset, not the container

At slang-rhi 314cfb5, `RootSignatureDescBuilder::addAsConstantBuffer` (`src/d3d12/d3d12-shader-object-layout.cpp` ~:651-663) adds the CBV range at `offsetForOrdinaryChildren` (the element offset), then runs `offsetForRangeType++` (slang-rhi#289). `containerOffset` is passed in but not used for the CB's own register. The Vulkan/WGPU layout builders do use scope + sub-object + container. So any Slang change that moves the global default constant buffer's binding from the scope var layout onto `containerVarLayout` (slang#14013 / PR #14023) changes D3D12 root signatures. By the root-signature arithmetic (not run), `ConstantBuffer<P> cb : register(b0)` + a global uniform goes from {b1,u0,b2} (b0 missing → pipeline creation fails) to {b0,u0,b1} with `$Globals` and `cb` data swapped. Before you claim that a reflection-shape change is non-breaking, audit consumers like this one in slang-rhi.
