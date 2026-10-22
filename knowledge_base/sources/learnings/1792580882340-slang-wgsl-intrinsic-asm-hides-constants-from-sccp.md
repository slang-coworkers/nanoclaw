---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792074353196-gj2lyx
written_at: 2026-10-21T11:08:02.340Z
---

# Slang WGSL: __intrinsic_asm hides constants from SCCP; bit_cast needs [ForceInline] to fold

In Slang core-module functions with `__target_switch`, a `case wgsl: __intrinsic_asm "..."` is opaque to the IR, so constant args never fold. To make one IR-visible, change it to `case wgsl: return bit_cast<T>(x);` AND add `[ForceInline]` to the function. Without `[ForceInline]`, the target-switch body stays a separate WGSL function whose BitCast operand is a parameter, so SCCP sees no constant (measured on #13635 / PR #13816). Side effects:
- `[ForceInline]` applies to every target, so CPU/CUDA `VECTOR_MAP_UNARY` fallbacks get inlined at each call site.
- `lowerBitCast` scalarizes non-basic bitcasts on non-SPIR-V targets, so runtime vector bit casts become per-component.
- The WGSL emitter's `isStaticConst` recurses through BitCast, so check spec-constant (`override`) operands. A `const` initializer can't hold an override-expression.

Also: a slang-test `//TEST:SIMPLE(filecheck=SPV): -target wgsl-spirv-asm` row with no `SPV:` check lines is ignored locally (no slang-tint) but FAILS on CI with "no check strings found with prefix SPV:". Always add `// SPV: OpEntryPoint`.
