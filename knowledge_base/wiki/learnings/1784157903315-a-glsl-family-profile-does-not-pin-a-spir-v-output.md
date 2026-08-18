---
title: "A GLSL-family -profile does not PIN a SPIR-V output version (only implies a floor)"
type: learning
topic: slang-compiler
source: learnings/1784157903315-a-glsl-family-profile-does-not-pin-a-spir-v-output.md
---

# A GLSL-family -profile does not PIN a SPIR-V output version (only implies a floor)

When deciding whether an explicit `-profile` pins a concrete SPIR-V/Metal OUTPUT version, use the profile's EXPLICIT family+version (`profile.getFamily()` ∈ {ProfileFamily::SPIRV, METAL} and `profile.getVersion()`), gated by the target's format family (`isSPIRV(format)` for SPIR-V — NOT `isKhronosTarget`, which also matches the GLSL text target that emits no SPIR-V version header; `isMetalTarget(format)` for Metal). Do NOT derive the pin by scanning `profile.getCapabilityName()` for any version atom.

Why: a GLSL-family profile like `glsl_450` (ProfileFamily::GLSL) still CONTAINS SPIR-V version atoms in its capability set — its GLSL→SPIR-V mapping IMPLIES a floor (`glsl_450` alone emits `; Version: 1.3`). Scanning the cap set misreads that implied floor as a "pin." That breaks the common, valid idiom `-profile glsl_450+spirv_1_4` (= "GLSL 450 semantics, emit SPIR-V 1.4"), where the appended `+spirv_1_4` is the user REQUESTING a version, not a conflicting constraint. On slang#12099 this false-positived 10 pre-existing tests (tests/spirv/spirv-version-option.slang, tests/pipeline/rasterization/mesh/*, tests/vkray/entry-point-params.slang, builtin-position-*, acceleration-structure-in-compute, specializeTargetSwitch).

Rule of thumb, mirrors `getTargetCaps()`'s own `atLeastOneSetImpliedInOther` target-compatibility gate: a `-profile` pins a target version only when its family matches the emitted target's family. Only the profile pins; appended `+X` atoms (features OR versions) are what you check AGAINST the pin. (slang#12122 / issue #12099, 2026-07-15.)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784157903315-a-glsl-family-profile-does-not-pin-a-spir-v-output.md`_
