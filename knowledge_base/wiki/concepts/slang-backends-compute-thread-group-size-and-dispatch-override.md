---
title: "Compute thread-group size: where the launch size comes from (reflection), what a dispatch-time override can do per backend, and what the shader sees"
type: concept
group: slang-backends
tags: [slang, slang-rhi, numthreads, thread-group-size, block-size, blockDim, WorkgroupSize, SV_GroupIndex, SV_DispatchThreadID, getComputeThreadGroupSize, reflection, dispatch-override, cuda, metal, cpu, launch_bounds, generic-entry-point, cuLaunchKernel, driver-api, slang-rhi-961, slang-14136]
source_count: 4
---

# Compute thread-group size: reflection, dispatch-time override, and what the shader sees

A Slang compute entry point declares its group size with `[numthreads(x,y,z)]`. The runtime that launches the kernel (slang-rhi, render-test, a user's own host) reads that size back through reflection. On D3D12, Vulkan and CPU the size is baked into the compiled shader, while CUDA and Metal take the block size as a launch argument. A request to let the host choose a different size at dispatch time (slang-rhi#961) therefore touches three layers: the runtime that picks the size, the backend that may or may not honour it, and the shader code that assumed the declared size. This page records what each layer does today (slang-rhi main 30250fa, Slang master 6815ed82d, measured on the L40S) and how to test a launch size that differs from `[numthreads]`.

## TL;DR

- **slang-rhi CUDA and Metal always launch with the reflected `getComputeThreadGroupSize` of the linked program.** There is no override, no `dispatchThreads`, and no per-pipeline or per-function maximum check.
- **A generic value-param entry point is the working per-size workaround today:** `[numthreads(N,1,1)] void k<let N:int>(...)`, specialized as `k<777>`, reflects (777,1,1), launches 777 threads per block, and `WorkgroupSize()` returns 777. It costs one pipeline per size.
- **The still-generic entry point reflects (0,1,1).** A launch from an unspecialized layout would use `blockDim.x = 0`.
- **CPU cannot honour a host override.** Slang's CPU codegen bakes the group loop into `<entry>_Group`, so treat CPU like D3D12/Vulkan (size fixed in the shader).
- **CUDA launches any block up to the FUNCTION limit, which can be below the device's 1024.** Validate against `cuFuncGetAttribute(CU_FUNC_ATTRIBUTE_MAX_THREADS_PER_BLOCK)`, not `DeviceLimits`. A future `__launch_bounds__(N)` would cap it at N.
- **Under a different launch size, `WorkgroupSize()` keeps the `[numthreads]` constant on CUDA and Metal**, because it is folded at compile time (slang#14136). `WaveGetNumWaves` uses the folded size too.
- **CUDA `SV_GroupIndex`/`SV_DispatchThreadID` come from `blockDim` and stay correct; Metal `SV_GroupIndex` is built from the `[numthreads]` literals**, so it is correct only for x-only overrides.
- **`-capability metallib_4_0` emits `[[required_threads_per_threadgroup(N)]]`,** which any other host size violates. Metal non-uniform threadgroups (`dispatchThreads:`) need Apple4+ or a Mac GPU, so they need a feature query.
- **slang-test/render-test cannot show a block-size bug:** it always launches the reflected size. Compile `-target ptx` and launch with a 30-line CUDA driver-API harness instead.

## Where the launch size comes from

slang-rhi CUDA sets `blockDim` from `EntryPointReflection::getComputeThreadGroupSize` of the pipeline's program layout. The chain is `cuda-pipeline.cpp:91` → `cuda-shader-object-layout.cpp:259` → `cuLaunchKernel` at `cuda-command.cpp:681-688`. slang-rhi Metal (`metal-command.cpp:900/911`) does the same. Neither offers a dispatch-time override.

A runtime probe on the L40S (slang-rhi 30250fa, slang 2026.17.1) confirmed that a generic size flows through. `[numthreads(N,1,1)] probeGeneric<let N:int>` specialized to 777 launched exactly 777 threads per block: the thread count, the largest `SV_GroupIndex` + 1, and `WorkgroupSize().x` were all 777. Both specialization routes worked: `IModule::findAndCheckEntryPoint("probeGeneric<777>", COMPUTE)`, and `findEntryPointByName("probeGeneric")->specialize(SpecializationArg::fromExpr("777"))` followed by a composite, link, and `createShaderProgram(slangGlobalScope=linked)`. The unspecialized entry point reflects (0,1,1). On Vulkan, the `findAndCheckEntryPoint("name<777>")` route SIGSEGVs inside `passEncoder->end()`/`finish()`/`submit`, while the `specialize()` route works. `slang-rhi-tests -check-devices` runs the whole suite (about 130 s); it is not a query flag ([slang-rhi CUDA block size comes from reflection; generic numthreads works](../learnings/1793562777761-slang-rhi-cuda-block-size-comes-from-reflection-of.md)).

## What each backend can honour for a host-chosen size

Verified 2026-11-01 for slang-rhi#961 ([what each backend can honour](../learnings/1793562885466-dispatch-time-thread-group-size-override-what-each.md)):

| Backend | Can the host pick the size? | Constraint |
|---|---|---|
| D3D12, Vulkan | No | Size is fixed in the compiled shader. |
| CPU | No | The group loop is baked (`for (x = 0; x < 256; ++x)` in `<entry>_Group`), and `ComputeVaryingInput` carries only start/end group IDs. |
| CUDA | Yes, up to the function limit | Slang PTX has no `.maxntid`/`.reqntid`. The function limit can be below 1024: an 80-register kernel reports `CU_FUNC_ATTRIBUTE_MAX_THREADS_PER_BLOCK = 768`, and launching 1024 fails with `LAUNCH_OUT_OF_RESOURCES`. |
| Metal | Uniform sizes yes; non-uniform needs a feature query | `dispatchThreads:` needs Apple4+ (A11) or a Mac GPU. `-capability metallib_4_0` emits `[[required_threads_per_threadgroup(N)]]`, which a different host size violates. |

Slang does not emit `__launch_bounds__` today. If it did (slang#14135), `.maxntid N` would cap the CUDA block size at N, and the override validation would have to read it. Register and occupancy limits on CUDA are on [[wiki/concepts/slang-backends-cuda-nvrtc-vs-offline-nvcc.md]] ([`__launch_bounds__`/`__maxnreg__`](../learnings/1793543915235-slang-cuda-xnvrtc-maxrregcount-is-a-no-op-on-ptx-o.md)).

## What the shader sees when the launch size differs from `[numthreads]`

Consider a `[numthreads(256)]` kernel launched with 128-thread blocks. Measured at 6815ed82d for #14136:

- `WorkgroupSize().x` is 256, because `WorkgroupSize()` is folded to a compile-time constant (see [[wiki/concepts/slang-b-language-semantics.md]]). `WaveGetNumWaves` also uses the folded size.
- `cudaBlockDim().x` is 128.
- `SV_DispatchThreadID` and `SV_GroupIndex` are correct, because the CUDA legalizer computes them from `blockDim` (`slang-ir-legalize-varying-params.cpp:2442-2463`).

So CUDA is internally inconsistent under an override. Metal differs again: `SV_GroupIndex` is computed from the `[numthreads]` literals (`emitCalcGroupExtents`), while `SV_DispatchThreadID` is the native `thread_position_in_grid` ([WorkgroupSize vs blockDim inconsistency](../learnings/1793543960963-slang-testing-cuda-kernels-launched-with-a-block-s.md)).

## Testing a launch size that differs from `[numthreads]`

slang-test and render-test always launch CUDA kernels with the reflected `[numthreads]` size, so they cannot show a bug that appears only when the host picks another size. Compile with `slangc x.slang -target ptx -entry K -o k.ptx`; uniform pointer params become plain kernel arguments in declaration order. A 30-line C driver-API program then calls `cuModuleLoadData` and `cuLaunchKernel(f, gx,1,1, bx,1,1, 0,0, args,0)`. Build it with `gcc drv.c -I/usr/local/cuda/include -L/usr/local/cuda/lib64/stubs -lcuda`; it runs on the L40S. A SIGBUS ("Bus error") from slangc in a shared checkout usually means a sibling session rebuilt `build/Release` while the binary was running, so check the mtime of `libslang-compiler.so` before suspecting a compiler crash ([testing CUDA kernels launched with a block size != numthreads](../learnings/1793543960963-slang-testing-cuda-kernels-launched-with-a-block-s.md)).

**Source learnings (4):**
- [slang-rhi CUDA block size comes from reflection of the linked program; generic numthreads works on L40S](../learnings/1793562777761-slang-rhi-cuda-block-size-comes-from-reflection-of.md) — `getComputeThreadGroupSize` → `cuLaunchKernel`; `k<777>` launches 777; unspecialized reflects (0,1,1); Vulkan `findAndCheckEntryPoint("name<777>")` SIGSEGV
- [Dispatch-time thread-group size override: what each backend can honour (slang-rhi#961)](../learnings/1793562885466-dispatch-time-thread-group-size-override-what-each.md) — CPU bakes the loop; CUDA function limit < 1024; Metal `SV_GroupIndex` from literals; `metallib_4_0` `required_threads_per_threadgroup`
- [Testing CUDA kernels launched with a block size != `[numthreads]`; WorkgroupSize vs blockDim inconsistency (#14136)](../learnings/1793543960963-slang-testing-cuda-kernels-launched-with-a-block-s.md) — PTX + driver-API harness; `WorkgroupSize()` folded, `blockDim` live; SIGBUS means a sibling rebuild
- [`-Xnvrtc --maxrregcount` is a no-op on PTX output; `__launch_bounds__`/`__maxnreg__`](../learnings/1793543915235-slang-cuda-xnvrtc-maxrregcount-is-a-no-op-on-ptx-o.md) — a `__launch_bounds__(N)` would cap the CUDA block size

_Catalog: [[wiki/index.md]]_
