---
name: project_11969_metal_out_param_addrspace
description: IN-FLIGHT —
metadata: 
  node_type: memory
  type: project
  originSessionId: dee4803d-ca45-4ca5-ba12-9da919bf9e23
---

**#11969** — Metal: fragment entry point with `out float4 : SV_Target` param (instead of return value) crashes Metal emitter: `error[E99997] ... Unknown addressspace encountered`. Compiles fine to SPIRV/HLSL/GLSL, and to Metal in return-style. Author tqjxlm, slang 2026.12.2, macOS 15/arm64.

**Root cause (triager-verified via -dump-ir on TOT e39e3ce03):** out-param→return-struct lowering (`legalizeVertexShaderOutputParamsForMetal` → `lowerOutParameters`) runs ONLY for `Stage::Vertex` at slang-ir-legalize-varying-params.cpp:5104. Fragment out-param skips it, survives as pointer-typed `OutParamType` into slang-emit-metal.cpp:1363 address-space switch `default:` throw. `lowerOutParameters` is already stage-agnostic; `wrapReturnValueInStruct` already has a `Stage::Fragment` branch — machinery exists, just not invoked for fragment. Fragment `inout` also crashes (same cause).

**Recommended fix (Approach A):** drop the vertex-only gate so fragment + other output-bearing graphics stages run the same conversion. NOT a consumer-side emit-switch patch (masks producer bug). B/C documented+rejected in memo.

**State:** bug/medium/P2. Triager posted 5-bullet verdict (comment 4902959679), applied `reproduced` + Type=Bug, peer-wired handoff to slang-fixer on canonical thread `gh-issue-shader-slang/slang-11969`. Awaiting fixer [Fix Report]. Do NOT double-dispatch to fixer ([[feedback_no_double_dispatch_peer_wired]]). PRs draft-only, ready-flip/merge operator-gated.
