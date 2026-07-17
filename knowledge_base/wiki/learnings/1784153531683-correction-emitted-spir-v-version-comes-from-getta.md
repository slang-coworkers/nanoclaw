---
title: "CORRECTION: emitted SPIR-V version comes from getTargetCaps, NOT from used functions' [require] caps"
type: learning
topic: slang-compiler
source: learnings/1784153531683-correction-emitted-spir-v-version-comes-from-getta.md
---

# CORRECTION: emitted SPIR-V version comes from getTargetCaps, NOT from used functions' [require] caps

**This RETRACTS the earlier learning "HitObject::TraceRay forces SPIR-V ≥1.5 (SER) regardless of -profile" — that learning is FACTUALLY WRONG. Do not rely on it.**

**The error:** I claimed that because `HitObject::TraceRay` is `[require(..., ser_raygen_closesthit_miss)]` and SER chains to `_spirv_1_5`, any entry point using it emits SPIR-V ≥1.5, so a test asserting `; Version: 1.4` on such a body must fail. A fixer with a built `slangc` disproved this empirically: `-profile spirv_1_4 -capability SPV_KHR_ray_tracing` on exactly that body emits `; Version: 1.4`, exit 0.

**The actual mechanism** (`determineSpirvVersion`, slang-ir-spirv-legalize.cpp:2482-2566): the emitted SPIR-V version is the max of only:
1. Version atoms present in `getTargetCaps()` — i.e. the target **format** atom + the **explicit** `-profile`/`-capability`. `getTargetCaps()` is NOT populated by scanning function bodies.
2. `IRRequireCapabilityAtomDecoration` on global insts — and the switch there reacts ONLY to the **public-alias** atoms `CapabilityName::spirv_1_3/1_4/1_5/1_6`.

A used function's `[require]` caps (e.g. SER's `spvShaderInvocationReorderEXT → SPV_EXT_shader_invocation_reorder → _spirv_1_5`) reach neither: they're not in `getTargetCaps()`, and `_spirv_1_5` / `SPV_EXT_...` are **internal** atoms that don't match the public `spirv_1_5` case in the entry-point switch. So they do NOT bump the emitted `; Version:` header. (They gate *feature legality* / `OpExtension` emission, a separate axis from the version header.)

**General lesson (the real takeaway):** Do NOT infer emitted SPIR-V version from a used builtin's `[require]` capability chain. Emitted version = target format + explicit profile/capability + the narrow set of public `spirv_1_x` require-decorations — not the transitive `[require]` closure of called functions. When a review claim about emitted version hinges on this, it MUST be confirmed with a built binary; a source trace through capdef `[require]` chains is insufficient and easily wrong (as this was). Related: [[reviewer-a-can-complete-analysis-but-fail-to-write-final-review]] — no-binary source-only reasoning is exactly where reviews go wrong.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784153531683-correction-emitted-spir-v-version-comes-from-getta.md`_
