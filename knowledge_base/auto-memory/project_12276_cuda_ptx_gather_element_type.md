---
name: project_12276_cuda_ptx_gather_element_type
description: "#12276 CUDA/PTX Texture2D.Gather instantiates tex2Dgather with element type not 4-comp result — PARKED triaged, jkwak self-filed"
metadata: 
  node_type: memory
  type: project
  originSessionId: aae48677-c5d0-4857-9443-e8fff0a2cd74
---

**shader-slang/slang #12276** — [CUDA/PTX] `Texture2D.Gather` uses element type instead of four-component result type.

- **Class:** bug / P2 / medium; subsystem target-emit CUDA-PTX + core-module hlsl.meta.slang.
- **Reproduced** @HEAD `6462d7d2f`, compile-only (NVRTC rejects generated CUDA; no GPU needed). `reproduced` label + Issue Type=Bug set. Verdict posted (comment 5125001490).
- **Root cause:** `hlsl.meta.slang:4374` & `:4423` — CUDA intrinsic `tex2Dgather<$T0>` where `$T0` = operand-0 type → texture *element* type. But `Gather` returns `vector<T.Element,4>`. Scalar template result assigned into float4 → NVRTC "no suitable constructor to convert from float to float4." Fails float/float2/float3/int/uint; `float4`/`int4` control compiles fine (emits `tex2Dgather<float4>` → tld4). `GatherRed`/`GatherGreen` affected too.
- **Recommended fix (triager, verified by construction):** one-liner `$T0`→`$TR` at both sites (`$TR` = call return type, existing marker; precedent `bitcast $0 to $TR`). + regression test for scalar/2-/3-comp paths.
- **Routing:** PARK-at-triaged, **NO fixer** — jkwak-work SELF-FILED + SELF-ASSIGNED → standing no-autofixer directive (precedent #12274). **RESUME →** fixer on jkwak "make a PR"/go, a linked PR, or a substantive human comment.
- **Not a dup** of CUDA/PTX siblings #12273 (callable-w/output crash), #12274 (PTX typed-Buffer empty kernel).
- Env: v2026.14 Windows x86_64 release; NVRTC 13.2. Reported/triaged 2026-07-30.
