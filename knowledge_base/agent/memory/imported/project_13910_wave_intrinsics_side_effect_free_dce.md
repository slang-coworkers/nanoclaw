---
type: project
name: project_13910_wave_intrinsics_side_effect_free_dce
description: "HUMAN-OWNED, nothing dispatched (10-25 07:3xZ). slang#13910 (albertrodriguezclo, external): wave/subgroup stdlib intrinsics (QuadReadLaneAt, WaveReadLaneFirst, WaveActiveSum) lack [__readNone], so IRInst::mightHaveSideEffects keeps unused calls and DCE cannot drop them. Seen on the author's own PR #13649 (WGSL QuadReadLaneAt lowering emits 4 quadBroadcasts; 3 dead after constant-lane folding). Explicit design question to maintainers (new attribute vs [__readNone]; convergence forbids hoisting). No chain of ours depends on it."
---

# slang#13910: unused wave intrinsic calls survive DCE

**10-25 07:31:38Z `issue_opened`.** Main webhook session `sess-1792913559273-zukpjb` (thread
`gh-issue-shader-slang/slang-13910`). Live read at 07:3xZ: open, 0 comments, no labels, no assignees,
body unchanged.

**Claim checked at source level on master `52e29ab43b`.** `QuadReadLaneAt` in `source/slang/hlsl.meta.slang`
(~line 17563) has `__target_switch` + `__intrinsic_asm` and no `[__readNone]`. `IRInst::mightHaveSideEffects`
(`source/slang/slang-ir.cpp`, `kIROp_Call` case) treats a call as side-effecting unless
`isSideEffectFreeFunctionalCall` holds or it carries `IRIgnoreSideEffectsDecoration`. So the report's mechanism
is accurate. Not run end-to-end: the repro test exists only on the #13649 branch.

**Why it is a maintainer question, not a bot fix.** `[__readNone]` also licenses CSE and possibly code motion;
subgroup ops are convergent, so the author asks whether a new "removable but not movable" attribute is needed.
That is a design call for maintainers.

**Ownership.** Same external author as #13906 and PRs #13903/#13905/#13907/#13908 (WGSL work, 10-25 morning).
The motivating PR #13649 (`fix/wgsl-wave-intrinsics-9972`, open, not draft) is theirs. The `fix/` prefix is the
author's branch name on a human PR, not a coworker branch.

**Disposition: held, nothing dispatched or posted.** Same pattern as
[project_13906_wgsl_comparison_sampling_non_depth_texture](project_13906_wgsl_comparison_sampling_non_depth_texture.md):
human-filed, addressed to maintainers, tied to the author's own PR; R6 (#13596) has the bot wait on human issues.

**Resume on:** an `@nv-slang-bot` mention on #13910/#13649, or an operator ask. No timer: nothing of ours
waits on this.
