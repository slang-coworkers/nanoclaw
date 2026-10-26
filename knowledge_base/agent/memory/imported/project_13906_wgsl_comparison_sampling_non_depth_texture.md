---
type: project
name: project_13906_wgsl_comparison_sampling_non_depth_texture
description: "HUMAN-OWNED, nothing dispatched (10-25 07:27Z). slang#13906 (albertrodriguezclo, external): on WGSL, SampleCmp*/GatherCmp* on a Texture2D<float> emit textureSampleCompare*/textureGatherCompare on texture_2d<f32>, which Tint rejects (needs texture_depth_*). Reproduced on master 52e29ab43b. Author's own fix PR #13907 (option 1: compile-time diagnostic in hlsl.meta.slang + tests/wgsl test; reviewer dshreiner-nv); option 2 (infer depth type) is a maintainer design question. No chain of ours depends on it."
---

# slang#13906: WGSL comparison sampling of a non-depth texture

**10-25 07:27:11Z `issue_opened`.** Main webhook session `sess-1792913233729-hoj35d` (thread
`gh-issue-shader-slang/slang-13906`). Live read at 07:28Z: open, 0 comments, no labels, body unchanged.
github-actions auto-assigned jkwak-work; the author is also an assignee.

**Claim checked on master `52e29ab43b`** (local Release build, the issue's repro): `slangc -target wgsl` emits
`var shadowMap_0 : texture_2d<f32>` and `textureSampleCompareLevel(shadowMap_0, cmpSampler_0, ...)` with no
diagnostic. The report is accurate. Metal avoids this with `__metal_asDepthTexture`; WGSL cannot reinterpret
a texture's type.

**Ownership.** The author opened **PR #13907** (`wgsl/compare-sampling-depth-check`) 4 s after the issue; it
references #13906, is not a draft, and requests dshreiner-nv. It changes `source/slang/hlsl.meta.slang`
(+16) and adds `tests/wgsl/compare-sampling-needs-depth-texture.slang` (+38). That is the issue's option 1
(compile-time error naming `DepthTexture2D`). Option 2 (retype a global texture used by a comparison op to
`texture_depth_*`, with reflection reporting a depth binding) is left to maintainers.

**Disposition: held, nothing dispatched or posted.** Same pattern as
[project_13847_target_ignore_capabilities_e36107](project_13847_target_ignore_capabilities_e36107.md) and
[project_13861_bundled_slang_tint_resource_table](project_13861_bundled_slang_tint_resource_table.md): a human
filed the issue with their own fix PR, so bot triage or a fix would duplicate it, and R6 (#13596) has the bot
wait on human issues. Same author filed PRs #13903/#13905/#13908 (WGSL) the same morning. No live chain of ours
covers WGSL comparison sampling (#9085 was GLSL `SampleCmpBias/Grad`).

**Resume on:** an `@nv-slang-bot` mention on #13906/#13907, or an operator ask. No timer: nothing of ours waits
on this.
