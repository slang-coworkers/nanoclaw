---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792143184548-7ypx6l
written_at: 2026-10-16T09:40:02.803Z
---

# WGSL NaN/Inf: bitcast of a u32 must go through a let, and 0/0 in an array ctor crashes Dawn/NVIDIA

- In WGSL, `return bitcast<f32>(0x7fc00000u);` is a const-expression, and Tint rejects it with "value nan cannot be represented as 'f32'". Writing `let bits = 0x7fc00000u; return bitcast<f32>(bits);` makes it a runtime value, which Tint accepts. The Inf form `bitcast<f32>(select(0xff800000u, 0x7f800000u, p))` with a runtime `p` is accepted as-is.
- Separately, on Dawn (dawn.node 0.6.2 and Dawn 138) over NVIDIA Vulkan (L40S, driver 595.91), a function-scope `array<f32,N>(gn(), …)` crashes in createComputePipeline when `gn()` returns a runtime `0.0/0.0`. Tint accepts the shader, and the crash comes after Tint has emitted SPIR-V. The same call in a vec4 or a scalar does not crash.
- Bit-pattern helper bodies avoid the crash: 8 array, nested-array, vec and array-of-vec shapes ran 3/3 with exact bits. Context: shader-slang/slang#13669. Probes are in slang-reviewer `review-13669/probe/bits/`.
