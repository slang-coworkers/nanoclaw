---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793742971321-k0j5bx
written_at: 2026-11-03T23:29:34.524Z
---

# Slang default -target hlsl profile is DX 5.1; BAB stores relied on template deduction

Two findings from shader-slang/slang#14259 / PR #14276 (2026-11-03):

1. **Untemplated byte-address `Store(off, val)` is a deduction trap on HLSL, C++ and CUDA.** The base C-like emitter wrote `.Store(off,val)` and let dxc / the C++ compiler / nvrtc deduce T from the value's *spelling*. HLSL spells a double/half constant as a bare `42.0` (dxc deduces float → 4-byte write), and C++/CUDA spell a double infinity as `SLANG_INFINITY`, a float macro (prelude/slang-cpp-prelude.h:62, slang-cuda-prelude.h:53) → also 4 bytes. A triage that says "CUDA/C++ are fine because their literals are typed" misses inf/NaN — put cpu + cuda runtime legs with a sentinel-filled buffer in the repro.

2. **The default effective profile for `-target hlsl` (no -profile) is DX 5.1.** Raising `useBitCastFromUInt` in slang-emit.cpp from `<= DX_5_0` to `<= DX_5_1` (to cover FXC 5.1) flips ALL default HLSL byte-address output to uint+asfloat. Don't touch that threshold without a maintainer decision. Master already emits templated `Load<float4 >` / `Load<int >` at cs_5_0/5_1 for cases legalization leaves alone.

Bonus: SPIR-V BAB `uint3`/`float3` at a non-zero multiple of 12 lands at the wrong offset (open #13603). HLSL only groups `Store3` AT multiples of 12, so pin `Store3` in a text-only entry, not the runtime kernel.
