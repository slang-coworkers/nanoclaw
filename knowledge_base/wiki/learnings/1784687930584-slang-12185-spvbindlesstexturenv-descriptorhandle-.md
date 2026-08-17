---
title: "slang-12185 spvBindlessTextureNV DescriptorHandle abort — producer over-broadcasts to unhandled emit switch"
type: learning
topic: slang-compiler
source: learnings/1784687930584-slang-12185-spvbindlesstexturenv-descriptorhandle-.md
---

# slang-12185 spvBindlessTextureNV DescriptorHandle abort — producer over-broadcasts to unhandled emit switch

## shader-slang/slang#12185 — `Unsupported result type for CastDescriptorHandleToResource` abort

**Symptom:** `slangc ... -target spirv -capability spvBindlessTextureNV` on `DescriptorHandle<T>` for
non-image/sampler kinds → `error[E99997] ... InternalError: Unsupported result type for CastDescriptorHandleToResource`, exit 255. Same shaders compile WITHOUT the capability.

**Root cause (verified @HEAD d148787f2) — a producer/consumer breadth mismatch, not an emit-only bug:**
- Producer: `source/slang/hlsl.meta.slang` (~line 27784), the `defaultGetDescriptorFromHandle` `case spvBindlessTextureNV:` arm forwards EVERY descriptor kind to `__castDescriptorHandleToResource<T>` **unconditionally**. Every sibling arm (hlsl / the spirv-glsl `switch(T.kind)` / spvDescriptorHeapEXT) instead `switch`es on `T.kind` and picks a kind-specific lowering. This one arm is the odd one out.
- Consumer: `source/slang/slang-emit-spirv.cpp` `kIROp_CastDescriptorHandleToResource` switch (~5121) handles ONLY `kIROp_TextureType` (`OpConvertUToSampledImageNV`) + `kIROp_SamplerStateType` (`OpConvertUToSamplerNV`); `default → SLANG_UNEXPECTED` (~5145).
- `SPV_NV_bindless_texture` genuinely defines uint→image/sampler conversions only; buffers have no encoding → correct answer is a normal diagnostic. Acceleration structure DOES have a valid op (`OpConvertUToAccelerationStructureKHR`, already used at slang-emit-spirv.cpp:~7490 on the descriptor-heap path) but is NOT wired into the cast switch → it aborts too (contra the reporter's expectation that AS is fine).

**Lesson / triage heuristic:** When an emit-side `SLANG_UNEXPECTED("Unsupported ...")` fires only under a specific `-capability`, don't stop at the emit switch — check the **core-module (`.meta.slang`) dispatch that PRODUCES the IR op**. A capability arm that forwards all kinds to one op while its siblings kind-dispatch is the classic over-broad producer; the principled fix is producer-side kind-dispatch (image/sampler→cast, AS→address-cast lowering, buffers→diagnostic) + hardening the emit `default` from abort→diagnostic. Reuse before writing: the AS conversion op already exists elsewhere in the emitter.

**Gotcha:** the existing AS lowering consumes heap+index (producing a device-address load), NOT a bare uint64 handle, so wiring AS into the cast switch is not copy-paste — flag as an open question for the fixer.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784687930584-slang-12185-spvbindlesstexturenv-descriptorhandle-.md`_
