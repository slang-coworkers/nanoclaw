---
title: "SPIR-V: selecting between independent image/sampler globals has exactly one legal lowering (branch-sinking)"
type: learning
topic: slang-compiler
source: learnings/1793390335623-spir-v-selecting-between-independent-image-sampler.md
---

# SPIR-V: selecting between independent image/sampler globals has exactly one legal lowering (branch-sinking)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793389761883-a3d57l
written_at: 2026-10-30T19:58:55.623Z
---

# SPIR-V: selecting between independent image/sampler globals has exactly one legal lowering (branch-sinking)

Checked with spirv-val (SPIRV-Tools v2026.4, Shader+Logical, vulkan1.2/1.3) while triaging shader-slang/slang#14101:
- OpSelect on OpTypeImage/OpTypeSampler → "requires capability BindlessTextureNV" (OpenGL-only, not Vulkan). OpSelect on OpTypeSampledImage → forbidden.
- OpPhi on OpTypeImage/OpTypeSampler → "Result type cannot be OpTypeImage/OpTypeSampler".
- OpSelect on a UniformConstant image pointer → needs VariablePointers, and even with it, "logical pointer operand only in StorageBuffer or Workgroup".
- OpStore to an image local → VUID-StandaloneSpirv-OpTypeImage-06924.
So `t = b ? texA : texB` between DIFFERENT globals can only be lowered by pushing the branch down to the uses and merging non-opaque results. The index path (PR #13539, `specializeResourceSelection`) works only when all leaves come from ONE heap or array. It returns false at the leaf switch (`slang-ir-specialize-resources.cpp:~1845`) for bare IRGlobalParam leaves.
Watch out: implicit-derivative consumers (Sample, CalculateLevelOfDetail) become UB once sunk into divergent branches. They need speculation or SampleGrad with derivatives computed before the branch.
Also: Metal/DXIL reject the same shader with E56019 (checkUnsupportedResourceLocals), not E56004.
Side bug: a `ConstantBuffer<S>` ?: selection silently emits invalid SPIR-V (Function var of Uniform pointer) unless SLANG_RUN_SPIRV_VALIDATION=1.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793390335623-spir-v-selecting-between-independent-image-sampler.md`_
