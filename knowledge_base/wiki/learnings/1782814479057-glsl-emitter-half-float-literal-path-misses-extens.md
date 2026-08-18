---
title: "GLSL emitter half-float literal path misses extension registration (slang #11836)"
type: learning
topic: slang-compiler
source: learnings/1782814479057-glsl-emitter-half-float-literal-path-misses-extens.md
---

# GLSL emitter half-float literal path misses extension registration (slang #11836)

**Symptom:** GLSL backend (`-target glsl` / `-emit-spirv-via-glsl`) emits a half-float literal like `61440.0HF` WITHOUT the `#extension GL_EXT_shader_explicit_arithmetic_types : require` directive, so glslang rejects the output. Same gap manifests for any half value that survives to emission *only as a literal* (not as a declared type).

**Mechanism (verified at HEAD c3037d220):** GLSL `#extension` directives are tracked by `ShaderExtensionTracker` (`m_glslExtensionTracker`); each base type registers its extension at its emit site via `GLSLSourceEmitter::_requireBaseType(BaseType)` → `requireBaseTypeExtension`, and they're written out in `emitFrontMatterImpl`.
- Tracker is CORRECT: `source/slang/slang-extension-tracker.cpp:65-75` maps `Half`/`Int16`/`UInt16` → `GL_EXT_shader_16bit_storage` + `GL_EXT_shader_explicit_arithmetic_types`; `:77-84` Int64→`..._int64`.
- Type-name path is CORRECT: `emitSimpleTypeImpl` calls `_requireBaseType(BaseType::Half)` before emitting `float16_t`.
- INT-literal path is CORRECT: `emitSimpleValueImpl` int branch calls `_requireBaseType(BaseType::UInt64)` before the `UL` suffix (`slang-emit-glsl.cpp:1403`).
- **THE GAP:** `emitSimpleValueImpl`, `kIROp_FloatLit` default branch (`slang-emit-glsl.cpp:1438-1449`) appends `"HF"` (HalfType) / `"LF"` (DoubleType) suffix WITHOUT calling `_requireBaseType(...)`.

**Discriminators that isolate it:** `StructuredBuffer<half>`/`<uint16_t>` and `uint16_t` local arithmetic ALL emit the directive (type-name + int-literal paths register). A bare `half h = 1.5hf; outFloat[0] = float(h)` does NOT — because `1.5hf` constant-folds to plain `1.5` so no half reaches emission. The bug only fires when a half value genuinely survives as a literal (e.g. via `bit_cast<uint16_t>(h)`).

**Principled-layer note:** the IR (`kIROp_FloatLit` of `kIROp_HalfType`) is canonical; extension tracking is inherently a GLSL-emit concern → fix at the emit literal site (mirror the int-literal sibling), not upstream. One-site fix; Half+UInt16 share the extension so it covers mixed repros. Test without GPU: `//TEST:SIMPLE(filecheck=CHECK): -target glsl ...` asserting the `#extension` line on emitted text.

**Sandbox gotcha:** `-emit-spirv-via-glsl` can't run here (downstream `slang-glslang` shared lib fails to load, E00100/E52002), but you don't need it — inspect the `-target glsl` text directly. Also: the nv-slang-bot token can POST issue comments but CANNOT apply labels (403 "Must have admin rights"); note label requests in the comment for a human.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782814479057-glsl-emitter-half-float-literal-path-misses-extens.md`_
