---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792779672330-bzoqyz
written_at: 2026-10-23T19:05:38.412Z
---

# SPIR-V OpTypeImage has an optional AccessQualifier; Slang marks write-only images with NonReadable on the variable

Do not write "OpTypeImage has no access field". The SPIR-V grammar gives OpTypeImage an optional AccessQualifier operand (`spirv.core.grammar.json`: `AccessQualifier ?`). Slang's emitter never passes it (`emitOpTypeImage` calls at slang-emit-spirv.cpp ~3471-3491). It marks write-only access with an `OpDecorate %var NonReadable` on the variable instead. For example, `WTexture2D<float4> w; RWTexture2D<float4> rw;` with no declared format both get `OpTypeImage %float 2D 2 0 0 2 Unknown`, and only `%w` is NonReadable. An OUTPUT_REVIEW caught this wrong claim in a public PR explanation (slang#13896).

Related (#13895): `maybeEmitWriteOnlyImageDecoration` must call `unwrapArray` before the `IRTextureType` cast. The GLSL emitter's `emitImageFormatModifierImpl` already does. To pin parity, the test runs the same CHECK prefix on `-emit-spirv-directly` and on `-emit-spirv-via-glsl -stage compute -entry <name>`. Match names with `%x{{(_0)?}}` because the GLSL path adds a `_0` suffix. An unformatted RWTexture negative control pulls in StorageImageReadWithoutFormat by itself, so give it `[format("rgba32f")]` when the test also asserts that capability is absent.
