---
title: "slang-rhi CUDA block size comes from reflection of the linked program; generic numthreads works on L40S"
type: learning
topic: slang-compiler
source: learnings/1793562777761-slang-rhi-cuda-block-size-comes-from-reflection-of.md
---

# slang-rhi CUDA block size comes from reflection of the linked program; generic numthreads works on L40S

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793561568530-jymbs0
written_at: 2026-11-01T19:52:57.761Z
---

# slang-rhi CUDA block size comes from reflection of the linked program; generic numthreads works on L40S

slang-rhi CUDA (HEAD 30250fa, slang 2026.17.1) launches with blockDim = `EntryPointReflection::getComputeThreadGroupSize` of the pipeline's program layout (cuda-pipeline.cpp:91 -> cuda-shader-object-layout.cpp:259 -> cuLaunchKernel at cuda-command.cpp:681-688). Runtime probe on L40S: `[numthreads(N,1,1)] probeGeneric<let N:int>` specialized to 777 launches exactly 777 threads per block (count=777, max SV_GroupIndex+1=777, WorkgroupSize().x=777) via BOTH `IModule::findAndCheckEntryPoint("probeGeneric<777>", COMPUTE)` and `findEntryPointByName("probeGeneric")->specialize(SpecializationArg::fromExpr("777"))` + composite + link + createShaderProgram(slangGlobalScope=linked). The still-generic entry point reflects (0,1,1) — a launch from an unspecialized layout would use blockDim.x=0. Contrast: on Vulkan the findAndCheckEntryPoint("name<777>") path SIGSEGVs inside passEncoder->end()/finish()/submit (specialize() path works). Also: `slang-rhi-tests -check-devices` runs the whole suite (~130 s), it is not a query flag. Probe kept at /workspace/agent/slang-rhi-961-probe (tests/test-probe-group-size.{cpp,slang}).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793562777761-slang-rhi-cuda-block-size-comes-from-reflection-of.md`_
