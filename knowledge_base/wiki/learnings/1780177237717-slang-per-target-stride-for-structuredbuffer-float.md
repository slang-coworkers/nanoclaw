---
title: "Slang per-target stride for `StructuredBuffer<float3, ScalarDataLayout>` — WGSL is the outlier"
type: learning
topic: slang-compiler
source: learnings/1780177237717-slang-per-target-stride-for-structuredbuffer-float.md
---

# Slang per-target stride for `StructuredBuffer<float3, ScalarDataLayout>` — WGSL is the outlier

A common Discord question shape: "How do I get tight 12-byte float3 packing across all my targets including WebGPU?" Slang's behavior is **inconsistent across targets** in a way that's worth knowing. DeepWiki gave two contradictory answers on the WGSL case during research, so the source files below are authoritative.

**Per-target stride for `StructuredBuffer<float3, ScalarDataLayout>` / `RWStructuredBuffer<float3, ScalarDataLayout>`** (verified against `getTypeLayoutRuleNameForBuffer` in [`source/slang/slang-ir-lower-buffer-element-type.cpp`](https://github.com/shader-slang/slang/blob/master/source/slang/slang-ir-lower-buffer-element-type.cpp)):

| Target | Layout arg respected? | Stride |
|---|---|---|
| D3D / HLSL | No (no-op — uses `Natural`; HLSL StructuredBuffer is tight by default) | 12 |
| Vulkan / SPIR-V (direct emit) | **Yes — required**, otherwise default is `Std430` = 16-byte stride | 12 |
| CUDA | No (`Natural` branch — tight by default) | 12 |
| Metal | No (`Natural` branch — tight by default) | 12 |
| **WGSL** | **No — and stride is 16, not 12** | **16** ❌ |

The WGSL outlier is hard-coded in the lowering pass. Comment in `slang-ir-lower-buffer-element-type.cpp` (~L1869-1874):

> *"For WGSL, an array of scalar or vector type will always be converted to an array of 16-byte aligned vector type. … We should setup loweredElementTypeInfo so the remaining logic can handle this case and insert proper packing/unpacking logic around it."*

So `<float3, ScalarDataLayout>` cannot give you 12-byte stride on WGSL.

**Workaround for tight float3 on WGSL**: use `RWByteAddressBuffer.Load<float3>(byteOffset)` / `.Store<float3>(byteOffset, value)` with explicit 12-byte stride. The `Load<float3>` is decomposed into three scalar `f32` loads at offsets `+0/+4/+8`. Where the scalarization is wired up:

- [`source/slang/slang-emit.cpp`](https://github.com/shader-slang/slang/blob/master/source/slang/slang-emit.cpp) — sets `byteAddressBufferOptions.scalarizeVectorLoadStore = true` for the `WGSL`, `Metal`, and CPU-via-LLVM target cases before calling byte-address legalization. (Earlier draft of this learning incorrectly attributed the flag-setting to `legalizeByteAddressBufferOps` itself; that function only consumes the flag.)
- [`source/slang/slang-ir-byte-address-legalize.h`](https://github.com/shader-slang/slang/blob/master/source/slang/slang-ir-byte-address-legalize.h) — `ByteAddressBufferLegalizationOptions::scalarizeVectorLoadStore` field, default `false`.
- [`source/slang/slang-ir-byte-address-legalize.cpp`](https://github.com/shader-slang/slang/blob/master/source/slang/slang-ir-byte-address-legalize.cpp) — the `emitLegalSequenceLoad` function emits the per-component scalar loads when the flag is set.

**Vulkan runtime gotcha**: when emitting SPIR-V with scalar layout (per-buffer or via `-fvk-use-scalar-layout`), the Vulkan device must enable `VkPhysicalDeviceScalarBlockLayoutFeatures::scalarBlockLayout = VK_TRUE` (core in Vulkan 1.2 via promotion of `VK_EXT_scalar_block_layout`). Without it, pipeline creation rejects the SPIR-V.

**Methodology note**: when DeepWiki answers conflict, grep the lowering passes — they're the ground truth. Pin citations to comment text or function name (`getTypeLayoutRuleNameForBuffer`, `emitLegalSequenceLoad`, the WGSL comment) rather than raw line numbers; line numbers in `master` move quickly. Use `~L<num>` notation in user-facing replies to make clear the line is a hint, not the anchor.

Discord thread that prompted this learning: https://discord.com/channels/1303735196696445038/1510396453007393011 (May 2026, slang-support, OP "Jo Basic" / j8asic).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780177237717-slang-per-target-stride-for-structuredbuffer-float.md`_
