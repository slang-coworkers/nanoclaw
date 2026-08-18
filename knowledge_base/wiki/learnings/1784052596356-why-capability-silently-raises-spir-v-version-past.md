---
title: "Why -capability silently raises SPIR-V version past explicit -profile (slang #12099)"
type: learning
topic: slang-compiler
source: learnings/1784052596356-why-capability-silently-raises-spir-v-version-past.md
---

# Why -capability silently raises SPIR-V version past explicit -profile (slang #12099)

**Symptom:** `slangc -target spirv-asm -profile spirv_1_4 ... -capability spvShaderInvocationReorderNV` silently emits `; Version: 1.5` (exit 0, no diagnostic), ignoring the explicit `-profile spirv_1_4`. Reproduced on ToT @3eeda847c via CLI/SPIR-V-text (no GPU).

**Root cause (verified @HEAD):** `-capability` atoms are folded into the target caps in `TargetRequest::getTargetCaps()` (`source/slang/slang-target.cpp:214-232`) with:
```
if (!targetCap.isIncompatibleWith(toAdd)) targetCap.join(toAdd);
```
`CapabilitySet::isIncompatibleWith` (`slang-capability.cpp:487-512`) returns "compatible" whenever the two sets share ANY target abstract node. `spirv_1_4` and `spirv_1_5` are the SAME SPIR-V target ⇒ they intersect ⇒ NOT incompatible ⇒ the join proceeds and takes the MAX version (`requireSpirvVersion` = `Math::Max`, `slang-ir-spirv-legalize.h:49-51`). **A SPIR-V version *raise* is a *compatible* join, never flagged.**

**Key gap:** nothing records that the profile's concrete version was USER-EXPLICIT vs defaulted (default is spirv_1_5 @slang-target.cpp:128). Any CLI-conflict diagnostic needs to add that flag first.

**Distinct from E41012/E41013:** those (`slang-check-shader.cpp:2538/2544`) fire for capabilities implied by SHADER CODE and the error variant is gated by `-restrictive-capability-check`. An explicit `-profile`/`-capability` CLI conflict is a different layer and wants an unconditional error (the #4165 analog for CLI).

**Discriminator for a correct fix:** key off "capability has NO valid realization at the explicit version (extension paths included)", NOT "default realization exceeds version" — because #12097 will give spvShaderInvocationReorderNV a valid SPIR-V 1.4 extension path, after which the same command should SUCCEED at 1.4, not conflict.

Fix layers: (A) at the getTargetCaps join (needs DiagnosticSink plumbed + fire-once guard, it's cached/multi-called); (B, cleaner) parse-time in slang-options.cpp. Both need the explicit-version flag.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784052596356-why-capability-silently-raises-spir-v-version-past.md`_
