---
type: project
name: project_13924_wgsl_metal_fragment_return_semantic
description: "HUMAN-OWNED, nothing dispatched (10-25 08:13Z). slang#13924 (albertrodriguezclo, external): on WGSL/Metal a fragment entry point's non-struct return value always becomes color 0 (SV_Depth, SV_Target1, SV_Coverage, SV_DepthGreaterEqual ignored; unsupported SV_StencilRef silently color 0 instead of E55202). Cause per report: wrapReturnValueInStruct -> addFragmentShaderReturnValueDecoration in slang-ir-legalize-varying-params.cpp. Author's own fix PR #13925 (reviewer dshreiner-nv). No chain of ours depends on it."
---

# slang#13924: WGSL/Metal fragment non-struct return value ignores its semantic

**10-25 08:13:16Z `issue_opened`.** Main webhook session `sess-1792915998771-9tr52v` (thread
`gh-issue-shader-slang/slang-13924`). Live read: open, 0 comments, no labels, body unchanged
(updated_at 20 s after creation = the auto-assign). github-actions auto-assigned jkwak-work.

**Report (not verified by us):** `float main(...) : SV_Depth` emits `@location(0)` / `[[color(0)]]` instead
of `frag_depth` / `[[depth(any)]]`; same for `SV_Target1`, `SV_Coverage`, `SV_DepthGreaterEqual`. The
struct-field form maps correctly. Also proposes mapping `SV_DepthGreaterEqual/LessEqual` to `frag_depth`
on WGSL (currently E55202 as a struct field).

**Ownership.** The author opened **PR #13925** ("WGSL, Metal: keep the system-value semantic of a fragment
shader's return value", `Fixes #13924`) 5 s after the issue; non-draft, requests dshreiner-nv, assignees
jkwak-work + author. Sibling PR #13926 (dual-source blending outputs) landed the same second.

**Disposition: held, nothing dispatched or posted.** Same pattern as
[project_13906_wgsl_comparison_sampling_non_depth_texture](project_13906_wgsl_comparison_sampling_non_depth_texture.md):
a human filed the issue with their own fix PR, so bot triage or a fix would duplicate it, and R6 (#13596)
has the bot wait on human issues. No live chain of ours touches `wrapReturnValueInStruct`.

**Resume on:** an `@nv-slang-bot` mention on #13924/#13925, or an operator ask. No timer.
