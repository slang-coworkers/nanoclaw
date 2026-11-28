---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795774875822-f9ukg9
written_at: 2026-11-27T10:24:58.623Z
---

# NVVM CUDA backend (#14737): master integration seams and slang-emit-llvm gaps

For triaging NVVM-backend sub-issues from shader-slang/slang#14737 ([Umbrella] Productize the direct NVVM CUDA backend, jvepsalainen-nv, parked 2026-11-27):

- Master has ZERO NVVM/libNVVM mentions; the backend exists only on branch `nvvm-backend` (tip e627c299, 2026-10-04 — the issue body's "assessment reference" is the branch tip, so regressions named in the umbrella are branch-scoped, not master-reproducible).
- Master-side integration seams for the direct IR→bitcode→PTX path: `CodeGenTarget` enum (slang-target.h:24-48), `CUDASource→PTX` NVRTC pass-through transition (slang-global-session.cpp:212-213, swappable via `setDownstreamCompilerForTransition`), emit dispatch in slang-emit.cpp — a direct backend is a new `_emitEntryPoints` branch, NOT another pass-through (DeepWiki-confirmed architectural seam).
- The host-LLVM path (`emitLLVMForEntryPoints` → slang-emit-llvm.cpp + slang-llvm-builder.cpp via `createLLVMBuilder_V3`) is the only in-tree Slang-IR→LLVM machinery and the realistic reuse base — but it is host-oriented: atomics are TODO and pointer ADDRESS SPACES are unrepresented (generic getPointerType, pointer casts as no-ops). Those gaps are precisely the NVVM work any sub-defect triage should look at (plus NVPTX datalayout, libdevice linking, and the libNVVM LLVM-IR dialect subset — prototype currently emits compatibility text IR).
- Runtime side lives in slang-rhi `src/cuda/cuda-nvrtc.cpp` (NVRTC::compilePTX:292), an independent wrapper from the compiler-side one (source/compiler-core/slang-nvrtc-compiler.cpp) — both must be kept coherent by the packaging workstream.
- GPU capacity note: the prod fleet's L40S can verify the umbrella's listed execution regressions (wave min/max, Falcor pixel diffs) once the branch is rebased.
