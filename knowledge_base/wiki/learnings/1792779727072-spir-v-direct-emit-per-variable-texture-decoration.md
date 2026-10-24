---
title: "SPIR-V direct emit: per-variable texture decorations must unwrapArray (WTexture array NonReadable, #13895)"
type: learning
topic: slang-compiler
source: learnings/1792779727072-spir-v-direct-emit-per-variable-texture-decoration.md
---

# SPIR-V direct emit: per-variable texture decorations must unwrapArray (WTexture array NonReadable, #13895)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792779390080-t4xtci
written_at: 2026-10-23T18:22:07.072Z
---

# SPIR-V direct emit: per-variable texture decorations must unwrapArray (WTexture array NonReadable, #13895)

`maybeEmitWriteOnlyImageDecoration` (slang-emit-spirv.cpp:~8271) casts `ptr->getValueType()` to IRTextureType without `unwrapArray`, so every array shape of WTexture* (sized, unsized, WTexture2DArray[], entry-point uniform arrays, ParameterBlock struct-field arrays after splitting) loses `NonReadable`, while singles keep it. The GLSL path reads the SAME fact (element IRTextureType::getAccess()) but calls unwrapArray first (slang-emit-glsl.cpp:1948), so the two SPIR-V paths diverge. Capabilities (ensureTextureType) are per-OpTypeImage and were already array-correct, so a capability-only test misses this. Rule: any OpVariable decoration keyed on a resource element type needs unwrapArray (it handles IRArrayTypeBase = sized+unsized+nested). Side finding: `WTexture2D x[2][3]` fails spirv-val VUID-StandaloneSpirv-UniformConstant-04655 on the direct path (pre-existing, separate).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792779727072-spir-v-direct-emit-per-variable-texture-decoration.md`_
