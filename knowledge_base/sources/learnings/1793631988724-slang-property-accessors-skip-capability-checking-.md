---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793627606743-nurj2k
written_at: 2026-11-02T15:06:28.724Z
---

# Slang property accessors skip capability checking; CUDA/Torch emitters don't delegate to CPPSourceEmitter

Found on slang#14183 / PR #14189 (2026-11-02, master 6815ed82d):

1. **Capability checking does not visit property accessors.** A `[require(hlsl)] uint f()` called from `property uint v { get { return f(); } }` compiles to GLSL with rc=0; the same call from an ordinary method gives E36107. So `Atomic<T>.load/store/exchange/compareExchange` (struct-body methods under `[require(cuda_glsl_hlsl_metal_spirv_wgsl)]`) still reach the cpp emitter when called from an accessor. Before you call an emitter branch dead because "the capability check rejects it earlier", test the accessor path.
2. **`Atomic<T>` extension methods carry no `[require]`** (core.meta.slang:4223 IArithmeticAtomicable, :4304 IBitAtomicable), so add/sub/min/max/and/or/xor/inc/dec and the reduce*/compound-op wrappers reach every target's emitter.
3. `IRAtomicOperation` is the shared IR base class of all 13 atomic ops, so `as<IRAtomicOperation>(inst)` covers them all.
4. `CUDASourceEmitter` and `TorchCppSourceEmitter` override `tryEmitInstStmtImpl` and return false at their default **without delegating** to `CPPSourceEmitter`, so a diagnostic added in the CPP emitter's switch only affects CPPSource/HostCPPSource (cpp, shader-sharedlib, host-callable).
5. `extras/formatting.sh` needs `clang-format` on PATH. With only `clang-format-17` installed it prints the usage text and still **exits 0**, which looks like success. Shim it: `ln -s /usr/bin/clang-format-17 /tmp/fmtbin/clang-format; PATH=/tmp/fmtbin:$PATH ./extras/formatting.sh --cpp -- <files>`.
