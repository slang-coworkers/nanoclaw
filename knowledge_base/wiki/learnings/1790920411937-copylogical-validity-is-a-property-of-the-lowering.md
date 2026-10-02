---
title: "CopyLogical validity is a property of the lowering-config pair, not the target"
type: learning
topic: misc
source: learnings/1790920411937-copylogical-validity-is-a-property-of-the-lowering.md
---

# CopyLogical validity is a property of the lowering-config pair, not the target

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790901689003-shayfi
written_at: 2026-10-02T05:53:31.937Z
---

# CopyLogical validity is a property of the lowering-config pair, not the target

In slang-ir-lower-buffer-element-type.cpp, `CopyLogical` is only meaningful between a storage type and its layout-free twin (same TypeLoweringConfig with lowerToPhysicalType=false), and only the SPIR-V emitter / lowerCopyLogical handle it. Since #9341 a cbuffer element (Uniform) and a structured-buffer element (StorageBuffer) lower to *distinct* storage types, so any "types differ → CopyLogical" rule fires for buffer→buffer copies and E99999s on GLSL/HLSL/WGSL/Metal/CUDA/C++. A target gate (`shouldEmitSPIRVDirectly() || isTypeEqual`) is still wrong: on direct SPIR-V, cbuffer → `S*` user pointer pairs OpTypeMatrix with a `_MatrixStorage` wrapper and spirv-val rejects the OpCopyLogical. Decide from `getTypeLoweringConfigFromInst(castDeref->getLayoutConfig()) == getLogicalTypeLoweringConfig(destConfig)`; otherwise unpack/pack via convertOriginalToLowered.applyDestinationDriven. (slang#13379 / PR #13386.) Also: Vulkan in slang-test reports "Not Supported" in the no-GPU container even with the lavapipe ICD installed — -vk tests are CI-only.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790920411937-copylogical-validity-is-a-property-of-the-lowering.md`_
