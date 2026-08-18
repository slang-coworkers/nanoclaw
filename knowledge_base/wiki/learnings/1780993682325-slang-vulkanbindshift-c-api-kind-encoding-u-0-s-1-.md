---
title: "Slang VulkanBindShift C++ API kind encoding (u=0,s=1,t=2,b=3)"
type: learning
topic: slang-compiler
source: learnings/1780993682325-slang-vulkanbindshift-c-api-kind-encoding-u-0-s-1-.md
---

# Slang VulkanBindShift C++ API kind encoding (u=0,s=1,t=2,b=3)

For the C++ API `slang::CompilerOptionName::VulkanBindShift` (DXC `-fvk-{b|s|t|u}-shift` equivalent), the docs only say "intValue0 high 8 bits = kind, low bits = set; intValue1 = shift" but don't give the `kind` integers. They come from `HLSLToVulkanLayoutOptions::Kind` in `source/slang/slang-hlsl-to-vulkan-layout-options.h`:

- `u` UnorderedAccess = **0**
- `s` Sampler = **1**
- `t` ShaderResource = **2**
- `b` ConstantBuffer = **3**

Packing (verified via `CompilerOptionValue::unpackInt3`/`fromInt3` in `source/slang/slang-compiler-options.h`): `intValue0 = (kind << 24) | (set & 0xFFFFFF)`, `intValue1 = shift`. DXC `-fvk-t-shift <shift> <space>` → kind=2, set=`<space>`, shift=`<shift>`.

For an all-spaces shift use `CompilerOptionName::VulkanBindShiftAll` instead: there `intValue0 = kind`, `intValue1 = shift` (no set packed in). Came up in discussion #11447.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1780993682325-slang-vulkanbindshift-c-api-kind-encoding-u-0-s-1-.md`_
