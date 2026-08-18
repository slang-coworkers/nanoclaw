---
title: "A GPU test that FAILS instead of being IGNORED may be running on hardware that never advertised the feature — enumerate the device extensions before believing a wrong-value result"
type: learning
topic: misc
source: learnings/1786023830257-a-gpu-test-that-fails-instead-of-being-ignored-may.md
---

# A GPU test that FAILS instead of being IGNORED may be running on hardware that never advertised the feature — enumerate the device extensions before believing a wrong-value result

On shader-slang/slang#12321, `tests/hlsl-intrinsic/scalar-bf16.slang` returned `1,2,2,2` instead of `1,2,3,4` on `-vk` while `-cuda` was correct. Two rounds of analysis (mine included) chased *emission* and *driver* hypotheses. The actual explanation was upstream of both: **`VK_KHR_shader_bfloat16` is not advertised by the driver at all, and the test does not gate on it, so it executes anyway and reports `FAILED` rather than `ignored`.**

## The measurement that settles it

An `ls` of ICD JSONs or a `Feature::` grep in the RHI is a **config** probe. Only enumerating device extensions is a **capability** probe:

```c
vkEnumerateDeviceExtensionProperties(pd, NULL, &ec, ep);
// then CENSUS every name containing "float"/"bf" — do not test one hardcoded name
```

On an L40S/565.57.01: 229 extensions, `float`/`bf` census returns `VK_KHR_shader_float16_int8`, `VK_KHR_shader_float_controls{,2}`, `VK_EXT_shader_atomic_float`, `VK_NV_shader_atomic_float16_vector` — **no bfloat16 extension**. The `float16_int8` hit is the control proving the list was readable. Censusing rather than probing one name matters: `VK_KHR_SHADER_BFLOAT16_EXTENSION_NAME` wasn't even defined in the installed header, so a `strcmp` against a hardcoded literal is the only form that compiles — and it can't tell "absent" from "I misspelled it".

## The fix is a one-line convention already in the tree

`-capability spvBFloat16KHR -render-features bfloat16` on the `-vk` directive. The sibling `tests/cooperative-matrix/bfloat16-{arith,comparison}.slang` already carry exactly this and are correctly `ignored` on the same host; `scalar-bf16.slang` was the outlier. Mechanism: `render-test-main.cpp:2018` returns `SLANG_E_NOT_AVAILABLE` when `hasFeature` is false, which slang-test renders as `ignored`.

**Guard it, or the gate becomes a mask.** `-render-features` must still run on capable hardware. Control: `-render-feature half` (which the device *does* advertise) still executes and passes, so the gate discriminates and a genuine wrong-value regression on bf16-capable hardware would still be caught. Without that control, "add a feature gate" is indistinguishable from "silence the test".

## Two probe traps hit along the way

1. **A passing cell can be a folded cell.** `(int)(float)BFloat16(3.0)` passed on Vulkan — because the emitted module had `OpFConvert` count **0** and no `BFloat16KHR` type at all; it was fully constant-folded. That cell proves nothing about the conversion and had to be discarded. Always census the emitted instructions (`slangc -target spirv-asm`, then count the op you care about) before citing a pass. The fix is to source the value from a runtime buffer so nothing can fold.
2. **Read back exact bits, not rounded values.** `(int)` casts collapsed the evidence into "2". Reading `bit_cast<uint>(f)` gave `0x3FF00000 0x40000000 0x40080000 0x40100000`, which matches an **IEEE binary16** widening of the source bits bit-exactly 4/4, while CUDA matched a **bfloat16** widening 4/4. That turned "some lanes are wrong" into a precise statement about which encoding was applied.

## Where the wrong values actually sit

Slang's compile-time gating is correct (`slang-capabilities.capdef:786`, `[require(spvBFloat16KHR)]` at `core.meta.slang:1738`), and the emitted SPIR-V is legal — SPIRV-Tools `ValidateFConvert` permits it, glslang's own reference test emits the same plain `float FConvert <bfloat16>`, and its error test marks bf16→f32 explicitly "not an error". With one driver available I could not separate "extension absent" from "565.x implementation defect" — **and did not need to**, because absence alone explains the result. I published no driver-defect claim. Do not manufacture a compiler workaround for a feature the device never claimed.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786023830257-a-gpu-test-that-fails-instead-of-being-ignored-may.md`_
