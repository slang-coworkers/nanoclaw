---
title: "Slang SPIR-V image access: write-only NonReadable decoration, OpTypeImage AccessQualifier, and array unwrapping"
type: concept
group: slang-backends
tags: [spirv, image, WTexture, NonReadable, OpTypeImage, AccessQualifier, unwrapArray, glsl-parity, StorageImageReadWithoutFormat]
source_count: 2
---

# Slang SPIR-V image access decorations

How Slang tells SPIR-V that a storage image is write-only, why that fact lives on the variable and not on the image type, and how the direct-emit and via-GLSL paths must agree for every array shape. The image FORMAT of `DescriptorHandle` textures (`Unknown`, #10024) is on [[wiki/concepts/slang-backends-spirv-descriptor-handles-and-heap.md]]; capability emission is on [[wiki/concepts/slang-backends-spirv-capabilities-and-version-gating.md]].

## TL;DR

- SPIR-V `OpTypeImage` HAS an optional AccessQualifier operand (`AccessQualifier ?` in `spirv.core.grammar.json`). Never write "OpTypeImage has no access field".
- Slang never passes that operand. It marks a write-only image with `OpDecorate %var NonReadable` on the variable.
- With no declared format, `WTexture2D<float4>` and `RWTexture2D<float4>` share one `OpTypeImage %float 2D 2 0 0 2 Unknown`; only the `WTexture` variable is `NonReadable`.
- Any `OpVariable` decoration keyed on a resource element type must call `unwrapArray` before the `IRTextureType` cast. `unwrapArray` handles `IRArrayTypeBase`: sized, unsized and nested arrays.
- Capabilities are per-`OpTypeImage` (`ensureTextureType`) and were already array-correct. A capability-only test does not catch a per-variable decoration bug.
- Pin direct-vs-via-GLSL parity with one CHECK prefix run on both paths. Match names with `%x{{(_0)?}}`, because the GLSL path adds `_0`.
- An unformatted `RWTexture` negative control pulls in `StorageImageReadWithoutFormat` by itself. Give it `[format("rgba32f")]` when the test asserts that capability is absent.

## The access fact lives on the variable, not the image type

The SPIR-V grammar gives `OpTypeImage` an optional AccessQualifier operand. Slang's `emitOpTypeImage` calls (`slang-emit-spirv.cpp` ~3471-3491) never pass it. Write-only access is instead an `OpDecorate %var NonReadable` on the variable. Consider `WTexture2D<float4> w; RWTexture2D<float4> rw;` with no declared format: both get `OpTypeImage %float 2D 2 0 0 2 Unknown`, and only `%w` is `NonReadable`. An OUTPUT_REVIEW caught the wrong claim "OpTypeImage has no access field" in a public PR explanation (slang#13896) ([OpTypeImage has an optional AccessQualifier; Slang marks write-only images with NonReadable](../learnings/1792782338412-spir-v-optypeimage-has-an-optional-accessqualifier.md)).

## WTexture arrays lose NonReadable on the direct path (#13895)

`maybeEmitWriteOnlyImageDecoration` (`slang-emit-spirv.cpp` ~8271) casts `ptr->getValueType()` to `IRTextureType` without `unwrapArray`. Every array shape of `WTexture*` therefore loses `NonReadable`: sized and unsized arrays, `WTexture2DArray[]`, entry-point uniform arrays, and `ParameterBlock` struct-field arrays after splitting. Single textures keep it. The GLSL emitter reads the same fact (the element's `IRTextureType::getAccess()`), but `emitImageFormatModifierImpl` calls `unwrapArray` first (`slang-emit-glsl.cpp` ~1948), so the two SPIR-V paths diverge. Capabilities come from `ensureTextureType`, per `OpTypeImage`, and were already right for arrays, which is why a capability-only test misses the bug ([per-variable texture decorations must unwrapArray](../learnings/1792779727072-spir-v-direct-emit-per-variable-texture-decoration.md)).

The fix test runs the same CHECK prefix on `-emit-spirv-directly` and on `-emit-spirv-via-glsl -stage compute -entry <name>`, and matches names with `%x{{(_0)?}}`. Its unformatted `RWTexture` negative control pulled in `StorageImageReadWithoutFormat` by itself, so the control needs `[format("rgba32f")]` while the test asserts that capability is absent ([OpTypeImage AccessQualifier; parity test recipe](../learnings/1792782338412-spir-v-optypeimage-has-an-optional-accessqualifier.md)).

Side finding, separate and pre-existing: `WTexture2D x[2][3]` fails spirv-val VUID-StandaloneSpirv-UniformConstant-04655 on the direct path ([per-variable texture decorations must unwrapArray](../learnings/1792779727072-spir-v-direct-emit-per-variable-texture-decoration.md)).

## See also

- [[wiki/concepts/slang-backends-spirv-descriptor-handles-and-heap.md]] — `DescriptorHandle` textures get format `Unknown` (#10024, closed-but-reverted #11130)
- [[wiki/concepts/slang-backends-spirv-capabilities-and-version-gating.md]] — capability/extension emission
- [[wiki/concepts/slang-backends-spirv-validation-testing-and-environment.md]] — spirv-val and test environment
- [[wiki/concepts/slang-backends-cuda-ptx-surface-asm-verification.md]] — texture format as type argument vs decoration across targets

**Source learnings (2):**
- [SPIR-V direct emit: per-variable texture decorations must unwrapArray (WTexture array NonReadable, #13895)](../learnings/1792779727072-spir-v-direct-emit-per-variable-texture-decoration.md) — GLSL path already unwraps; capability tests miss it; `[2][3]` VUID-04655 side finding
- [SPIR-V OpTypeImage has an optional AccessQualifier; Slang marks write-only images with NonReadable on the variable](../learnings/1792782338412-spir-v-optypeimage-has-an-optional-accessqualifier.md) — slang#13896 OUTPUT_REVIEW catch; parity CHECK recipe; `[format]` on the negative control

_Catalog: [[wiki/index.md]]_
