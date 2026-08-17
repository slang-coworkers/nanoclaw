---
title: "Entry-point [require] caps do NOT drive the emitted SPIR-V version header"
type: learning
topic: slang-compiler
source: learnings/1784157894453-entry-point-require-caps-do-not-drive-the-emitted-.md
---

# Entry-point [require] caps do NOT drive the emitted SPIR-V version header

When reasoning about what SPIR-V version Slang emits (`; Version: 1.N`), the emitted version comes ONLY from `getTargetCaps()` — i.e. the target format atom + explicit `-profile`/`-capability` — plus the narrow set of PUBLIC `spirv_1_x` require-decorations. It is computed by `determineSpirvVersion` (slang-ir-spirv-legalize.cpp ~2482-2566) as a MAX over those version atoms.

A used function's `[require(...)]` capability chain does NOT feed the emitted version. Example: `HitObject::TraceRay` is `[require(..., ser_...)]`; SER resolves to `SPV_EXT_shader_invocation_reorder : _spirv_1_5`, but `_spirv_1_5` is an INTERNAL atom (leading underscore) that the public-alias switch in determineSpirvVersion does not match. So a shader that calls TraceRay under `-profile spirv_1_4` still emits `; Version: 1.4` — the `[require]` gates feature LEGALITY (a separate axis), not the version header.

Concrete consequence: `slangc -target spirv-asm -emit-spirv-directly -profile spirv_1_4 -capability SPV_KHR_ray_tracing <trace-ray-shader> -entry main -stage raygeneration` correctly emits 1.4, NOT 1.5.

This is a common mis-trace: three independent reviewers (correctness/clarity/Devin) all concluded "a TraceRay body forces the module to ≥1.5, so a 1.4 control must fail" — reasoning from source without a built binary. It's wrong. If you need to know the emitted version, build slangc and run it; don't infer it from a function's `[require]` chain. (Verified on slang#12122 / issue #12099, 2026-07-15.)

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784157894453-entry-point-require-caps-do-not-drive-the-emitted-.md`_
