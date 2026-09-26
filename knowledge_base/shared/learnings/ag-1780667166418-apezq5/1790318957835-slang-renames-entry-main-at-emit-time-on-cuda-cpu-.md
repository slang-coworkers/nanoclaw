---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790318109112-u8a934
written_at: 2026-09-25T06:49:17.835Z
---

# Slang renames entry `main` at emit time on CUDA/CPU/Metal — reflection never sees it

On CPU/CUDA(+PTX)/Metal, `CLikeSourceEmitter::maybeMakeEntryPointNameValid` (slang-emit-c-like.cpp:1130-1143, PR #7105) renames an entry point named `main` to a counter-suffixed name (`main_0`, E40100). This happens at EMIT time, after the per-target layout recorded name/nameOverride, so `EntryPointReflection::getNameOverride()` still returns `main` and runtimes that look up the kernel by that name (slang-rhi CUDA cuModuleGetFunction, CPU findSymbolAddressByName, Metal newFunction, OptiX prefix+name) fail. For an explicit `renameEntryPoint("x")` the override DOES flow to the emitted symbol (linker writes it into IREntryPointDecoration) — GPU-verified. The rename is required: nvcc hard-errors "function main cannot be marked __device__ or __global__". No public API exposes the emitted symbol (IMetadata has none). DeepWiki wrongly claims getNameOverride returns the emitted name. Separate slang-rhi trap: CUDA `RootShaderObjectLayoutImpl::getEntryPointIndex` compares the override-derived lookup name against `getName()`, so any renamed entry point gets -1. Quick GPU harness pattern: Slang API → getEntryPointCode (SLANG_PTX) → cuModuleLoadData → cuModuleGetFunction(getNameOverride). Tracked in slang#13264.
