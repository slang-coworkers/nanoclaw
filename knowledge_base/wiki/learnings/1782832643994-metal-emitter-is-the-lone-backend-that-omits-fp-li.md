---
title: "Metal emitter is the lone backend that omits FP literal type suffixes"
type: learning
topic: slang-compiler
source: learnings/1782832643994-metal-emitter-is-the-lone-backend-that-omits-fp-li.md
---

# Metal emitter is the lone backend that omits FP literal type suffixes

**Finding (slang#11837, verified at HEAD c3037d220):** the Metal source emitter prints floating-point literals with NO type suffix, unlike every other C-like backend. `MetalSourceEmitter::emitSimpleValueImpl` (`source/slang/slang-emit-metal.cpp` ~:1128-1164) only special-cases NaN/±Inf for `kIROp_FloatLit`, then falls through to `CLikeSourceEmitter::emitSimpleValueImpl` (`source/slang/slang-emit-c-like.cpp:1422`) which emits the bare value. It never consults the literal's IR type, even though the `IRFloatLit` is correctly typed (`kIROp_HalfType` etc.).

**Why it matters:** MSL reads a bare `61440.0` as a 64-bit `double`. For value uses the Metal compiler implicitly converts, so the bug is normally invisible — BUT in a bit-size-sensitive position (`bit_cast`/`as_type<ushort>(...)`) the 64→16-bit reinterpret is rejected and the MSL won't compile. So `half h = 61440.hf; bit_cast<uint16_t>(h)` emits `as_type<ushort>(61440.0)` and fails. (The analogous `float` case usually const-folds, so `half` is what surfaces it.)

**Cross-backend contrast (templates for the fix):** WGSL appends `h`/`f` (`slang-emit-wgsl.cpp:1140-1157`), HLSL appends `f`, GLSL appends `HF`/`LF`. The principled fix is consumer-side: append the MSL suffix (`half`→`h`, `float`→`f`) for finite literals in the Metal `emitSimpleValueImpl`, mirroring WGSL; leave `double`/non-`IRBasicType` bare (Double already trips `SLANG_UNEXPECTED` in `emitSimpleTypeImpl`). NOT a frontend/IR bug — don't touch the producer; the literal type is already present in the IR.

**Known remaining gap:** the NaN/±Inf arms still emit bare double-typed `(0.0/0.0)` forms, so non-finite half/float in a size-sensitive context hits the same mismatch — a separate pre-existing path. Fixed in draft PR #11838 (finite-only, documented scope).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782832643994-metal-emitter-is-the-lone-backend-that-omits-fp-li.md`_
