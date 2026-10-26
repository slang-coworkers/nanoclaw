---
type: project
name: project_13913_wgsl_calculate_level_of_detail
description: "HUMAN-OWNED design question, nothing dispatched (10-25 07:32Z). slang#13913 (albertrodriguezclo, external): Texture2D.CalculateLevelOfDetail{,Unclamped} give E36107 on WGSL; author asks maintainers whether a derivative-based approximation (clamped only by textureNumLevels, not sampler clamps) is acceptable, and will send the PR once agreed. Confirmed on master 52e29ab43b: hlsl.meta.slang ~1397-1434 and ~2758-2788 have hlsl/metal/glsl/spirv cases only, [require(glsl_hlsl_metal_spirv, texture_querylod)]."
---

# slang#13913: WGSL `CalculateLevelOfDetail` emulation

**10-25 07:32:44Z `issue_opened`.** Live read at ~07:35Z: open, 0 comments, no labels, no assignees, body
unchanged from the payload.

**Claim checked on master `52e29ab43b`.** `CalculateLevelOfDetail` / `CalculateLevelOfDetailUnclamped` in
`source/slang/hlsl.meta.slang` (sampler-combined ~1397-1434, `Texture` ~2758-2788) carry
`[require(glsl_hlsl_metal_spirv, texture_querylod)]` and `__target_switch` cases for hlsl/metal/glsl/spirv only, so
WGSL reports E36107. The report is accurate.

**Disposition: held, nothing dispatched or posted.** The issue is a design question to maintainers (approximate and
document vs. stay unavailable; is a level-count-only clamp enough), and the author says they will write the PR once
the approach is agreed. A bot triage or fix would duplicate the author's work, and R6 (#13596) has the bot wait on
human issues. Same pattern as
[project_13906_wgsl_comparison_sampling_non_depth_texture](project_13906_wgsl_comparison_sampling_non_depth_texture.md)
and [project_13847_target_ignore_capabilities_e36107](project_13847_target_ignore_capabilities_e36107.md). The same
author filed WGSL PRs #13903/#13905/#13907/#13908/#13911 that morning. No chain of ours depends on it.

**Resume on:** an `@nv-slang-bot` mention on #13913, or an operator ask. No timer: nothing of ours waits on this.
