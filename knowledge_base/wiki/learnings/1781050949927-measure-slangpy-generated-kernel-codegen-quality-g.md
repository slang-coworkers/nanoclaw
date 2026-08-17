---
title: "Measure SlangPy generated-kernel codegen quality GPU-free via slangc SPIR-V opcode census"
type: learning
topic: slang-compiler
source: learnings/1781050949927-measure-slangpy-generated-kernel-codegen-quality-g.md
---

# Measure SlangPy generated-kernel codegen quality GPU-free via slangc SPIR-V opcode census

When asked to measure SlangPy generated-kernel quality (e.g. issue #806 "eliminate trampoline overhead") and the native build is blocked (no Vulkan/GUI dev headers; `install_packages` would restart the container and kill the session), you do NOT need `SLANGPY_PRINT_GENERATED_SHADERS=1` or a GPU. Measure GPU-free:

1. Get a **prebuilt, version-matched `slangc`** (match the repo's pinned Slang version exactly — prelude must match). On this box: `/workspace/agent/slang-2026.5.2/bin/slangc`.
2. Reconstruct the HEAD-generated kernel faithfully on the **real `import slangpy;` prelude** (ContextND/.map from core.slang, init_thread_local_call_shape_info from callshape.slang, marshall `__slangpy_load` = `read_buffer(_idx(call_id,_strides,_offset))`, body mirroring `slangpy/core/generator.py` emitters). Validate structure against a captured golden in `tests/.../generated_tests/*.slang`.
3. Compile to optimized SPIR-V (`-target spirv-asm -O3`) and run an **opcode census** (`OpFunctionCall`, `OpSDiv`/`OpSRem`, `OpIMul`/`OpIAdd`, loads, stores). Compare against a hand-rolled optimal kernel.

**Key finding for #806 (factual, SPIR-V-proven):** the SlangPy abstraction (ContextND, `.map`, CallShapeInfo switch, `__slangpy_load` shims, `[ForceUnroll]` loops) fully inlines under `-O3` — **0 OpFunctionCall**, byte-identical arithmetic to a hand kernel. The forward `_trampoline` is already gone (removed in #879; codegen moved to generator.py by #863/#870/#876). The issue body's described structure (`_trampoline → __slangpy_load`) is **stale**.

The **only** residual vs an optimal *contiguous* kernel is runtime index arithmetic (1 divide + 1 modulo + strided mul-adds + uniform loads) — NOT removable by any optimizer because **one kernel is cached per signature and reused across all tensor shapes/strides/offsets**. It's a design-inherent runtime cost, not a codegen defect. Closing it = per-shape "contiguous" specialization (runtime-perf, which #806 explicitly deferred).

**Labeled gaps:** (a) CUDA target does NOT pre-inline in slang — it defers to nvrtc/ptxas (not installed here), so the CUDA collapse is expected-but-unproven. (b) Whether the residual divmod matters perf-wise is unmeasured (hypothesis: negligible — these kernels are memory-bandwidth-bound). State both as hypotheses, not facts.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781050949927-measure-slangpy-generated-kernel-codegen-quality-g.md`_
