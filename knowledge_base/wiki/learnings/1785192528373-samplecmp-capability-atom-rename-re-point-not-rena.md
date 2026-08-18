---
title: "SampleCmp* capability-atom rename = re-point not rename (texture_shadowlod is shared)"
type: learning
topic: misc
source: learnings/1785192528373-samplecmp-capability-atom-rename-re-point-not-rena.md
---

# SampleCmp* capability-atom rename = re-point not rename (texture_shadowlod is shared)

On shader-slang/slang#12244 (clean up shadow-comparison texture capability-atom naming: SampleCmp/SampleCmpLevelZero/SampleCmpLevel/SampleCmpBias/SampleCmpGrad).

**The trap:** the naive read of "rename `texture_shadowlod` → `texture_shadow` because SampleCmp takes no LOD" is WRONG. `texture_shadowlod` is a SHARED capability atom. Besides the ~14 `SampleCmp*` `[require]` sites in `source/slang/hlsl.meta.slang`, it gates ~57 GLSL `textureLod`/`texture` overloads in `glsl.meta.slang` (lines 1961–4422) and 6 GLSL-emit helper sites in `hlsl.meta.slang` (890,900,920,1011,1021,1040). Renaming the atom ripples into every GLSL shadow-lod form. Correct move = ADD new atoms (`texture_shadow`, `texture_shadowbias`) + RE-POINT the SampleCmp* methods to them.

**Why it's behavior-neutral:** define the new atoms equal to the current expansions — `texture_shadow = texture_sm_4_1` (identical to today's `texture_shadowlod` alias, capdef:2424) and `texture_shadowbias` as an EXACT mirror of `texture_shadowgrad` (`_sm_6_8 | _GLSL_150 | spirv_1_0 | GL_EXT_texture_shadow_lod`, capdef:2433) so the SM6.8 floor is retained. Pure naming/grouping change.

**Constraints:** (1) atom names are USER-EXPOSED — usable in `[require(...)]` in user code, appear in diagnostics, and auto-generate into `docs/user-guide/a4-02-reference-capability-atoms.md`. So you MUST regenerate that doc (never edit it by hand) and add `///` doc comments on the new public aliases. Adding atoms is additive/safe; renaming a shared atom is not. (2) Preserve the #11156 baseline-vs-`GL_EXT_texture_shadow_lod` split — that split lives at the GLSL `textureLod` helper level (glsl.meta.slang + hlsl.meta.slang GLSL-emit helpers 890–1040), NOT at the SampleCmp `[require]` atom, so re-pointing SampleCmp is orthogonal, but a new `texture_shadowbias` must not gratuitously pull the extension onto baseline forms.

**Incidental inconsistency to fold in:** `SampleCmpLevel` separate-sampler BASE overload uses `texture_shadowlod` (hlsl.meta.slang:3144) while its OFFSET variant uses `texture_sm_4_1` (:3204); combined-sampler base/offset both use `texture_sm_4_1` (:1713/:1772). Normalize.

**Open design Q:** the clamp / `out uint status` overloads on `sm_5_0` (:1632/:1696/:3065/:3127) sit outside the proposed taxonomy — they carry a genuine SM5.0 status-return floor; recommend leaving them on `sm_5_0`.

**Routing:** bot-filed TRACKING issue at jkwak-work's request, explicitly deferred ("fine for now") → PARK (triage+verdict posted is the deliverable), hold slang-fixer handoff. Matches self-filed-and-deferred park pattern. Resume → fixer only when a maintainer says "make a PR" + picks scope A (full taxonomy) vs B (add only texture_shadow, leave Bias/Grad under shadowgrad).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785192528373-samplecmp-capability-atom-rename-re-point-not-rena.md`_
