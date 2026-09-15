---
title: "A downstreamCompile-timer super-linearity on a matrix kernel is nvrtc-intrinsic, not a Slang emit-size artifact"
type: learning
topic: slang-compiler
source: learnings/1789389982745-a-downstreamcompile-timer-super-linearity-on-a-mat.md
---

# A downstreamCompile-timer super-linearity on a matrix kernel is nvrtc-intrinsic, not a Slang emit-size artifact

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789378129500-zm3x52
written_at: 2026-09-14T12:46:22.745Z
---

# A downstreamCompile-timer super-linearity on a matrix kernel is nvrtc-intrinsic, not a Slang emit-size artifact

When a CUDA compile-perf sweep shows the **downstreamCompile timer** (the nvrtc portion) growing super-linearly on a matrix-heavy kernel, do NOT assume Slang is handing nvrtc a super-linearly-larger input. Verified on shader-slang/slang#13055 (2026-09-14):

- **Slang emits O(N) CUDA C++ for an N-matrix-multiply chain.** CUDA does not legalize/scalarize matrix types — `targetLegalizesMatrixTypes()` returns false for CUDA (`source/slang/slang-ir-legalize-matrix-types.cpp:29-30`, explicit CUDA/C++ no-op comment `:716-719`); matrices stay as the prelude `Matrix<T,ROWS,COLS>` struct (`prelude/slang-cuda-prelude.h:963-975`). `mul(matrix,matrix)` takes the generic triple-nested-loop body (`hlsl.meta.slang:13955-13979`), `[__readNone]` not force-inline ⇒ emitted **once** as a specialized helper with **N call sites** = O(N). Emit-side folding only folds single-use side-effect-free values, so no expression duplication.
- **The downstreamCompile timer boundary** (from PR #13050) wraps exactly the downstream `compiler->compile(options, artifact)` call — chrono at `source/slang/slang-code-gen.cpp:1028`, elapsed added via `getSession()->addDownstreamCompileTime(...)` `:1032`. For `-target ptx`/`cuda` that `compiler` is the NVRTC wrapper (`source/compiler-core/slang-nvrtc-compiler.cpp`, `nvrtcCompileProgram`). So it isolates nvrtc's own source→PTX cost and EXCLUDES Slang's IR passes — meaning it also excludes the already-tracked Slang-side O(n²) redundancy-removal cost (#13010/#13059). (The `slang-emit.cpp:3642-3661` timer is the SPIR-V/spirv-opt path, not CUDA.)

⇒ If the super-linearity shows up in the downstreamCompile bucket on an O(N)-source matrix kernel, it is genuinely nvrtc-intrinsic → upstream NVIDIA (the #13016/spirv-opt precedent), with no Slang code lever. Likely mechanism (hypothesis): matrix chains force high register pressure + long dependency chains, pathological for nvrtc's register allocator/scheduler, whereas low-pressure scalar-accumulator workloads stay sub-linear at equal source size.

Also: the reporter's `backend_matrix`/`gen_matrix_chain`/`backend_loads`/`resource_aggregate` workloads are LOCAL/uncommitted — grep of `tools/compile-perf/` returns zero; the only committed PTX spec is `codegen_ptx` (`manifest.py:579-590`) using `gen_codegen` (scalar sin/cos math). Don't try to reproduce their exact numbers from the repo.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789389982745-a-downstreamcompile-timer-super-linearity-on-a-mat.md`_
