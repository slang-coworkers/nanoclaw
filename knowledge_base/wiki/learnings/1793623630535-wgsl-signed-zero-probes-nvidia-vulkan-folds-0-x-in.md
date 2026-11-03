---
title: "WGSL signed-zero probes: NVIDIA Vulkan folds 0-x into -x, Tint const-eval drops -0, spec allows ignoring zero sign"
type: learning
topic: slang-compiler
source: learnings/1793623630535-wgsl-signed-zero-probes-nvidia-vulkan-folds-0-x-in.md
---

# WGSL signed-zero probes: NVIDIA Vulkan folds 0-x into -x, Tint const-eval drops -0, spec allows ignoring zero sign

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793622178702-cs7zit
written_at: 2026-11-02T12:47:10.535Z
---

# WGSL signed-zero probes: NVIDIA Vulkan folds 0-x into -x, Tint const-eval drops -0, spec allows ignoring zero sign

Context: shader-slang/slang#14179 (WGSL vector Neg emitted as `(vecN<T>(0) - x)` loses -0.0).

- WGSL spec, section "Differences from IEEE-754" (index.bs ~L14386): "Implementations may ignore the sign field of a floating point zero value." So the `0 - x` form is spec-legal. The issue is about bit parity between targets, not conformance.
- Runtime on the L40S via node `webgpu@0.6.2` with `backend=vulkan`: `(vec3<f32>(0) - x)` with x=+0 still gives 0x80000000. Tint's dumped SPIR-V shows `OpFSub %null %x`, so the NVIDIA driver folds the literal-zero subtraction into a negate. `z - x` where z is +0 read from a buffer gives +0. You can't reproduce the bug on NVIDIA Vulkan. The reporter saw it with Tint->MSL on Metal. To get Tint's SPIR-V, pass `create(['backend=vulkan','enable-dawn-features=dump_shaders,disable_symbol_renaming'])`; it prints to stdout.
- Tint const-eval folds `-(vec3<f32>(0.0,1,2))` to the +0 constant (`OpConstantComposite %float_0 ...`). For constant operands, -0 is lost with both forms.
- i32: concrete i32 overflow wraps in const-eval too, per spec "modulo 2^bitwidth". naga and Tint both accept `const r = vec3<i32>(0) - vec3<i32>(i32(-2147483648))`. Don't claim the subtraction form is rejected for INT_MIN.
- `--x`: naga rejects it ("expected expression, found --") and Tint accepts it. Emitters must keep `- -x` spaced or parenthesized. Slang scalar Neg already emits `- - x`.
- Pitfall: `isSignedType` (slang-ir-util.cpp:3455) has no case for kIROp_HalfType. Using it to choose the native unary path would silently keep f16 vectors on the subtraction path. Use `!(isIntegralType(e) && !isSignedType(e))` or an explicit unsigned check.
- slang-test `-wgpu` rows show as ignored because of SLANG_EXCLUDE_DAWN=ON in the build. Use Dawn node to run them instead.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793623630535-wgsl-signed-zero-probes-nvidia-vulkan-folds-0-x-in.md`_
