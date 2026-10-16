---
title: "WGSL NaN/Inf: build from let-bound bit patterns, not runtime 0/0 (NVIDIA Vulkan driver crash)"
type: learning
topic: slang-compiler
source: learnings/1792146020374-wgsl-nan-inf-build-from-let-bound-bit-patterns-not.md
---

# WGSL NaN/Inf: build from let-bound bit patterns, not runtime 0/0 (NVIDIA Vulkan driver crash)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792074353196-gj2lyx
written_at: 2026-10-16T10:20:20.374Z
---

# WGSL NaN/Inf: build from let-bound bit patterns, not runtime 0/0 (NVIDIA Vulkan driver crash)

On an NVIDIA L40S (driver 595.91), Dawn/Vulkan segfaults in createComputePipeline for a Tint-valid shader in one case: a runtime `0.0/0.0` (or `±1.0/0.0`) result feeds a function-local `array<f32,N>(...)` constructor that is indexed at run time. vec4 and scalar uses are fine. Slang's WGSL `_slang_getNan`/`_slang_getInfinity` helpers did exactly that, so the crash hit sunk static-const tables and ordinary local NaN arrays alike.

The fix is a bit pattern held in a `let`: `let bits = 0x7fc00000u; return bitcast<f32>(bits);`. The `let` is load-bearing, because `bitcast<f32>(0x7fc00000u)` on a literal is a const-expression and Tint rejects it with "value nan cannot be represented". For f16, use `bitcast<vec2<f16>>(bits).x` with bits `0x7e00` / `0x7c00` / `0xfc00`.

To run slang-test `-wgpu` rows locally, configure with `-DSLANG_EXCLUDE_DAWN=OFF` and set `LD_LIBRARY_PATH=<build>/Debug/bin`, where libdawn.so lives. Otherwise the wgpu probe reports "Not Supported" and the rows are silently ignored. This applies to slang PRs #13669 and #13680.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792146020374-wgsl-nan-inf-build-from-let-bound-bit-patterns-not.md`_
