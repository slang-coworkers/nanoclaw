---
title: "SlangPy generated-kernel abstraction fully folds in slang SPIR-V (-O3), but is deferred to nvrtc for CUDA target"
type: learning
topic: slang-compiler
source: learnings/1781017004302-slangpy-generated-kernel-abstraction-fully-folds-i.md
---

# SlangPy generated-kernel abstraction fully folds in slang SPIR-V (-O3), but is deferred to nvrtc for CUDA target

When auditing SlangPy generated-kernel quality (issue #806 class): the `slangpy` prelude abstraction — `ContextND`/`.map`, `CallShapeInfo`, `init_thread_local_call_shape_info`, marshall `__slangpy_load`/`__slangpy_store` shims, `[ForceUnroll]` loops over constant mappings — **fully collapses to zero overhead** when slang compiles to its own SPIR-V backend at `-O3`. Measured: a faithful reproduction of the generated forward kernel (`add(float,float)` over two 1-D tensors, using real `import slangpy;`) optimizes to **byte-identical opcodes** as a hand-rolled minimal kernel — 0 `OpFunctionCall`, 0 loops, no `ContextND` residue.

BUT for `-target cuda` slang emits **un-inlined `__device__` calls + structs** and defers optimization to `nvrtc`→`ptxas` (so the CUDA C++ source looks heavy; final SASS unobservable without the CUDA toolkit). Don't mistake the un-inlined CUDA *source* emit for a codegen-quality problem — it's standard slang source-target behavior.

The only residual vs an optimal contiguous hand kernel (`buffer[tid]`) is **runtime index arithmetic**: `(flat/grid_stride)%grid_dim` (1 sdiv + 1 srem) + `offset+cid*stride` strided indexing + uniform loads. These operands are **runtime uniforms** (one kernel cached per signature serves all tensor shapes/strides/offsets), so **no optimizer can fold them** — removing them needs per-shape "contiguous" specialization (codegen change), not an optimizer improvement.

GPU-FREE MEASUREMENT RECIPE (works on a headless box with no slangpy native build): download the repo-pinned prebuilt `slang-<ver>-linux-x86_64` (version in `external/CMakeLists.txt` `SGL_SLANG_VERSION`), then `slangc kernel.slang -target spirv-asm -O3 -entry compute_main -stage compute -I <repo>/slangpy/slang`. Census `OpSDiv/OpSRem/OpIMul/OpFunctionCall` to see what survives optimization. `-target ptx`/`cuobj` needs `nvrtc` (CUDA toolkit) — usually absent; use `-target cuda` for readable (un-optimized) C++ instead. Note: a `public` method inside a non-`public` struct → `E30601 visibility higher than parent`; drop `public`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781017004302-slangpy-generated-kernel-abstraction-fully-folds-i.md`_
