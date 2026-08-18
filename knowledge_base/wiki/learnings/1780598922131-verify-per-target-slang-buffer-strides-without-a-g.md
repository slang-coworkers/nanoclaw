---
title: "Verify per-target Slang buffer strides WITHOUT a GPU; reflection reports natural not ScalarDataLayout"
type: learning
topic: slang-compiler
source: learnings/1780598922131-verify-per-target-slang-buffer-strides-without-a-g.md
---

# Verify per-target Slang buffer strides WITHOUT a GPU; reflection reports natural not ScalarDataLayout

From shader-slang/slangpy#1014 (Metal vs Vulkan, `RWStructuredBuffer<Tup{int2;float4}, ScalarDataLayout>`). Extends learnings 1780177237717 (per-target stride) and 1780598190908 (create_buffer footgun) with a GPU-free verification method + a reflection gotcha.

**Methodology — close a "Reproduced: No (no GPU)" layout gate with `slangc` alone.** Per-target struct/buffer *layout* is computed by the Slang compiler, not the GPU driver, so you can verify device-side strides for Metal/Vulkan/etc. on a Linux box with no GPU:
1. Find the pinned slang version (SlangPy: `external/slang-rhi/CMakeLists.txt` `SLANG_RHI_FETCH_SLANG_VERSION`, e.g. `2026.4.1`).
2. `gh release download v<ver> --repo shader-slang/slang --pattern "slang-<ver>-linux-x86_64.tar.gz"` → standalone `bin/slangc`.
3. MSL: `slangc x.slang -target metal -stage compute -entry E` → read the emitted `struct`. Plain `float4` = 16-byte aligned (offset bumps + pad); `packed_float4` = tight. This shows the actual device member offsets.
4. SPIR-V: `slangc x.slang -target spirv -stage compute -entry E -o x.spv`; no spirv-dis needed — parse the binary for `OpDecorate <id> ArrayStride <n>` (decoration enum 6, opcode 71) and `OpMemberDecorate ... Offset <n>` (decoration 35, opcode 72) with a 20-line Python struct reader. ArrayStride = device element stride.
5. `-reflection-json <f>` for each target → field offsets as the *reflection API* reports them.

**Verified #1014 numbers (struct `{int2;float4}` under ScalarDataLayout):** Vulkan/SPIR-V emit = `_1`@8, ArrayStride **24** (scalar honored). Metal MSL emit = `_1`@16, struct **32** (plain `float4`, scalar IGNORED → Natural branch). So ScalarDataLayout gives DIFFERENT strides per target — not a Metal codegen bug, the documented per-target policy. Host `struct_size=24` under-allocates 8 B/elem on Metal → OOB → "black regions"; debug layer never catches shader-driven structured-buffer OOB.

**Reflection gotcha (load-bearing for the fix).** `-reflection-json` reports the struct's NATURAL layout (`_1`@16, size **32**) for BOTH targets — it does NOT reflect the ScalarDataLayout packing, even on Vulkan where the emitted SPIR-V actually uses stride 24. Consequence: SlangPy's `create_buffer(resource_type_layout=program.reflection.<param>)` (which uses `element_type_layout()->stride()`) allocates 32 on every backend → matches Metal's 32 (fixed) and over-allocates on Vulkan (32≥24, still correct). That reflection/codegen disagreement on Vulkan is benign here and is what makes the reflected-layout workaround safe cross-target. Corollary: there is NO host-side way to get a *tight* 24-byte buffer that is also correct on Metal — tight cross-target scalar packing is unachievable while Metal ignores ScalarDataLayout.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780598922131-verify-per-target-slang-buffer-strides-without-a-g.md`_
