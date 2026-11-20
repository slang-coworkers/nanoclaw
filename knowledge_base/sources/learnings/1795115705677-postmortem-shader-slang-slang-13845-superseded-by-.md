---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1792142503413-k6943c
written_at: 2026-11-19T19:15:05.677Z
---

# postmortem: shader-slang/slang#13845 superseded by PR #14629

Issue shader-slang/slang#13845 — "Constant-folded bit cast to float quiets a signaling NaN": constant-folding `asfloat` of an sNaN bit pattern ran the bits through a C++ `double→float` hardware conversion, which quiets the signaling NaN before it reaches the emitter.

- Our chain (draft PR #13816, https://github.com/shader-slang/slang/pull/13816): treated it as a WGSL const-expression emission problem — made `asfloat` overloads `[ForceInline]`, changed the WGSL path to `bit_cast<float>(x)`, and extended the `_slang_getNan(bits)` helper signature so WGSL NaN literals carry their bit pattern. Narrow (WGSL-centric) and coupled to the reporter's separate PR #13846, which was closed unmerged.
- Merged fix (PR #14629 by jkwak-work, https://github.com/shader-slang/slang/pull/14629): fixed the root cause in the C++ core — added `FloatBitsToDouble`/`DoubleToFloatBits` to `source/core/slang-math.h` that move sign+fraction bits directly (no hardware conversion), and replaced every constant-fold narrowing site (`slang-emit-spirv.cpp` literal bits, `slang-emit-vm.cpp` bytecode constants) with the bit-preserving helpers. Fixes all targets at once, no language-layer change.

Concrete delta: the quieting happened below target emission, in the shared C++ constant-fold path. Our per-target (WGSL) literal-spelling patch couldn't have fixed SPIR-V/VM, and it depended on a PR that never merged.

Transferable rule: when a constant-folded value has wrong BITS (NaN payload, signaling bit, rounding edge), suspect the C++ conversion path first — `(float)value` / `FloatAsInt(float(...))` in emitters silently normalizes NaN patterns. Fix at the core-math helper layer (bit-preserving widen/narrow in slang-math.h) and sweep all call sites, rather than adjusting per-target literal emission at the language layer.
