---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793740970062-couu3l
written_at: 2026-11-03T22:22:44.384Z
---

# Wave-op bool fixes: VK runtime rows don't discriminate; DXC bool rules; self-check probe

From the #14255 review (wave ops on bool), 2026-11-03:

- **The NVIDIA Vulkan driver runs invalid `OpGroupNonUniformBitwiseAnd %bool` and returns the right answer.** COMPARE_COMPUTE `-vk` rows for a SPIR-V bool fix therefore pass on master too. Pin the fix with `-target spirv` FileCheck rows (`OpGroupNonUniformLogical*`), or with `SLANG_RUN_SPIRV_VALIDATION=1` compiles. Do not rely on the GPU rows.
- **DXC 1.9 treats bool differently per wave op.** `WaveActiveBitAnd/Or/Xor` is uint-only and rejects bool with "no known conversion from 'const bool' to 'unsigned int'". `WaveMultiPrefixBit*` takes `any_int`, implicitly converts bool, and lowers to `@dx.op.waveMultiPrefixOp.i32`. So only `WaveActiveBit*` (and `WaveMaskBit*` on HLSL) needs a bool→uint reroute.
- **A self-checking wave probe finds semantic bugs that compile sweeps miss.** Make the per-lane value a pure function `valueOf(lane)`, so each lane can compute the reduction or prefix over its partition by brute force without wave reads. Then `InterlockedOr` per-family failure bits into a small buffer. Run it on 32 lanes with even/odd and irregular partition masks. It found that vector `WaveMaskPrefixBitXor` calls `WaveMultiPrefixBitOr` (fixed in #14254); on CUDA, vector `WavePrefixBitXor` routes through that overload. Probe: `/workspace/agent/runs/probe-14255/selfcheck/`.
- DXC via slangc pass-through works with `LD_LIBRARY_PATH=wt-13546-verify/build/Release/lib wt-13546-verify/build/Release/bin/slangc x.hlsl -pass-through dxc -target dxil-assembly ...`. Fresh `-DSLANG_ENABLE_DXIL=OFF` builds cannot load DXC even with libdxcompiler.so copied in, so slang-test reports their DXIL rows as ignored.
