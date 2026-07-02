---
title: "Spurious E41012 profile-upgrade warning: static [require] out of sync with emit-time isCombined gate (samplerless)"
type: learning
topic: agent-ops
source: learnings/1782889962730-spurious-e41012-profile-upgrade-warning-static-req.md
---

# Spurious E41012 profile-upgrade warning: static [require] out of sync with emit-time isCombined gate (samplerless)

**Symptom (slang #11874):** `slangc -target glsl -profile glsl_450` on a **combined** `Sampler2D.Load()` emits a spurious `warning E41012: profile implicitly upgraded → GL_EXT_samplerless_texture_functions`, even though the generated GLSL (`texelFetch(usampler2D,…)`) correctly omits the `#extension`. Diagnostic-only — codegen is fine.

**Mechanism — two independent, out-of-sync capability paths:**
1. **Static `[require(...)]`** on a core-module method lowers to `IRLateRequireCapability` (`slang-lower-to-ir.cpp:9482`) and drives the profile-upgrade check `checkCapability()` in `source/slang/slang-ir-late-require-capability.cpp:83-94` (emits **E41012 ProfileImplicitlyUpgraded**). This is **pre-emit and unconditional** — it does NOT see a method's generic `let isCombined` value or which `__target_switch` branch is taken.
2. **Emit-time `__requireTargetExtension("GL_EXT_...")`** inside the method's GLSL body is what actually writes the `#extension` line, and CAN be gated (e.g. `if (isCombined == 0) __requireTargetExtension(...)`).

**Root cause pattern:** `Texture.Load` (hlsl.meta.slang:4519, generic in isCombined) carried an unconditional `[require(…, texture_sm_4_1_samplerless)]` where `texture_sm_4_1_samplerless = texture_sm_4_1 | GL_EXT_samplerless_texture_functions` (capdef:2350). Its GLSL emission was already correctly gated `if(isCombined==0)` at :4614-4615. So the static require fires the warning for combined samplers while the extension is (correctly) never emitted → mismatch.

**The correct precedent already in-tree:** `GetDimensions` uses **emit-time-only** — `[require(…, texture_sm_4_1)]` (NO samplerless) + `if(isCombined==0) __requireTargetExtension(...)` (slang-core-module-textures.cpp:481-482 / :615). It never warns spuriously.

**Takeaways:**
- An instantiation-dependent (bare-vs-combined) capability CANNOT be expressed by a static `[require]` on a method generic over the discriminator — `[require]` can't reference a generic `let`. Model it at emit time via `__requireTargetExtension` gated on the generic, and use a NON-extension base atom (`texture_sm_4_1`) in `[require]`. Don't duplicate the requirement in both places.
- `texture_sm_4_1` already implies `spirv_1_0`, so dropping the `_samplerless` alias loses nothing for SPIR-V.
- **Discriminator recipe** for "spurious profile-upgrade warning but extension correctly absent": compile the combined and bare variants separately with `-target glsl -profile glsl_XXX` and grep for `E41012` vs `#extension` — if the warning fires without the extension, the static `[require]` is out of sync with an emit-time `__requireTargetExtension` gate. Compare against the sibling method (GetDimensions) that behaves correctly.
- History: PR #5585 removed `GL_EXT_samplerless_texture_functions` from combined-sampler **emission** but left the static **require** → this class of bug.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1782889962730-spurious-e41012-profile-upgrade-warning-static-req.md`_
