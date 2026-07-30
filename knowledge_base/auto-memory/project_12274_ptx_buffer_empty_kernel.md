---
name: project_12274_ptx_buffer_empty_kernel
description: "#12274 [PTX] typed Buffer<T>.Load silently emits empty CUDA/PTX kernel — triaged, parked"
metadata: 
  node_type: memory
  type: project
  originSessionId: bf28cc43-ed22-4083-b4ab-072df74f26be
---

**shader-slang/slang#12274** — `[PTX] Buffer access silently compiles to an empty kernel`. Author + self-assignee: jkwak-work.

Compiling `Buffer<float4>` read → `RWStructuredBuffer<float4>` write for `-target ptx`/`cuda` succeeds with NO diagnostic but silently omits the load+store → PTX entry is just `ret;`. Silent miscompile + missing-diagnostic.

**Root cause (confirmed @HEAD 6462d7d2f, compile-only/no-GPU):** `Buffer<T>` = `_Texture<T,__ShapeBuffer,...>`. `_Texture.Load`'s `__target_switch` (hlsl.meta.slang:19361-19375) has NO `cuda` case; a case-less switch on the active target emits an EMPTY helper body `_Texture_Load_0(){}` (not a diagnostic), NVVM strips the dead ops. `Load` already carries `[require(glsl_hlsl_metal_spirv, ...)]` which *excludes* cuda.

**Triage verdict:** bug / medium / P2 / target-emit CUDA-PTX + core-module. Recommended fix = **A: fail loudly with a diagnostic** (enforce the existing capability at the CUDA call site; mirrors #6304 WGSL resolution; reporter explicitly accepts a clear diagnostic). Approach B (implement CUDA typed-Buffer load) = HIGH-risk feature work, needs GPU verify, may re-hit the PTX `tex.1d` limit that got the prelude impl `#if 0`'d.

Resembles **#6304** (WGSL Buffer/RWBuffer silent empty shader) but NOT a dup — no prior PTX/CUDA issue.

**State: PARKED at triaged — NO fixer dispatch** per [[feedback]] no-autofixer-jkwak-self-filed (jkwak author+self-assigned, didn't ask "make a PR"). Triager applied `reproduced` label + Issue Type=Bug (left human's `Dev Opened` untouched), posted 5-bullet on issue (comment `5124885609`). Fix scope caveat: don't over-reject the StructuredBuffer family (real pointers on CUDA). **Re-engage triggers:** jkwak's explicit "make a PR"/go, a linked PR, or a substantive human comment. Related: [[project_12192_e55215_constantbuffer_no_source_location]] (CUDA/CB emit), [[project_12273_cuda_callable_output_crash]] (CUDA crash cluster).