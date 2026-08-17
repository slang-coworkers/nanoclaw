---
title: "SPIR-V direct-resource-param gate: relaxing isIllegalSPIRVParameterType by 'not-rejected-by-GLSL' leaks feedback/unknown/array textures (#12195)"
type: learning
topic: slang-compiler
source: learnings/1784772370437-spir-v-direct-resource-param-gate-relaxing-isilleg.md
---

# SPIR-V direct-resource-param gate: relaxing isIllegalSPIRVParameterType by "not-rejected-by-GLSL" leaks feedback/unknown/array textures (#12195)

PR #12195 (`-fvk-use-direct-resource-params`, draft) relaxes exactly one gate in `isIllegalSPIRVParameterType` (`slang-ir-specialize-resources.cpp:~1371`) so read-only textures stay as resource-typed SPIR-V function params instead of being specialized into a bindless `uint` descriptor index. Reviewer-A (correctness) top finding — a reusable review lens:

**The relaxed gate draws its boundary as "any `IRTextureType` NOT already rejected by `isIllegalGLSLParameterType`" rather than "read-only texture."** `isIllegalGLSLParameterType`'s access switch only rejects `READ_WRITE`, `WRITE`, `RASTER_ORDERED`. But `IRTextureType::getAccess()` (`slang-ir.h:~1424`) also returns `SLANG_RESOURCE_ACCESS_FEEDBACK` (FeedbackTexture2D) and `SLANG_RESOURCE_ACCESS_UNKNOWN` (non-constant access operand) — both hit `default: break`, so with the flag ON they now pass directly as `OpTypeImage` params (feedback textures are D3D-only, no meaningful SPIR-V form). Separately, the caller does `type = unwrapArray(type)` FIRST (`:40-41`), so `Texture2D tex[N]` arrays also pass by-value — a path the sampler special-case just below deliberately forbids for samplers. None tested.

**Lens:** when a PR *relaxes* a rejection predicate, check what the relaxed set actually admits — enumerate the full range of the discriminator (here `getAccess()`), not just the cases the sibling guard names. "Stays specialized regardless" claims in a new comment are a scope contract that needs a regression test pinning it (RW/feedback param STAYS specialized with flag on).

Cross-checks: this extends learning #12004 (textures are otherwise ALWAYS specialized by-index; the by-value-vs-by-index choice lives in the specialize step, not emit; SPIR-V fixes must `spirv-val`). Reviewer C (clarity) independently flagged the same naming/scope mismatch (flag/help say "texture/image resources" but only read-only sampled textures benefit — GLSL image types always specialize) and a provable test-comment↔FileCheck-order contradiction in the DEFAULT block. Verdict: APPROVE_WITH_NITS (0 bugs, 3 gaps) — fine for a default-off experimental draft.

**Ops note:** Devin (Reviewer B) timed out at 30m on this DRAFT PR (`devin-error.txt: "did not reach a stable done state within 30m"`, exit 3 semantics). Draft PRs sometimes never settle a Devin analysis anonymously; A+C still give a full report — note the timeout in the verdict, don't call it a code signal, and a later re-run (Devin auto-re-analyzes on new commits) may recover it.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784772370437-spir-v-direct-resource-param-gate-relaxing-isilleg.md`_
