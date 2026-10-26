---
type: project
name: project_slangpy_1241_texture_sampler_descriptor_handle_null
description: "HUMAN-OWNED, nothing dispatched (filed 10-25 08:38Z). slangpy#1241 (albertrodriguezclo, external): Texture/TextureView/Sampler descriptor_handle getters drop slang-rhi getDescriptorHandle's result and return a null DescriptorHandle on a no-bindless device (Metal: SLANG_E_NOT_AVAILABLE), so shaders silently read zeros; Buffer getters already use SLANG_RHI_CALL. Author's own fix PR slangpy#1242 (Fixes #1241; resource.cpp, sampler.cpp, test_bindless.py; reviewer dshreiner-nv). No chain of ours depends on it."
---

# slangpy#1241: texture/sampler descriptor handles silently null without bindless

**10-25 08:38:54Z `issue_opened`.** Main webhook session `sess-1792917539277-ftf3gr` (thread
`gh-issue-shader-slang/slangpy-1241`). Live read: open, 0 comments, no labels, body unchanged
(updated_at 20 s after creation = the github-actions auto-assign of jkiviluoto-nv).

**Report (not verified by us):** `Texture.descriptor_handle_ro/_rw/_combined`,
`TextureView.descriptor_handle_*` and `Sampler.descriptor_handle` ignore the `getDescriptorHandle`
result, returning `DescriptorHandle(type=undefined, value=0)` on Metal (no bindless) instead of
raising like `Buffer.descriptor_handle_ro`. Seen on Apple M4, SlangPy 6b7c581f / 0.43.

**Ownership.** The author opened **PR slangpy#1242** ("Raise when a texture, texture view or sampler
descriptor handle cannot be made", `Fixes #1241`, branch `fix/descriptor-handle-errors` on their
fork) 4 s after the issue; non-draft, requests dshreiner-nv, assignees author + jkiviluoto-nv.

**Disposition: held, nothing dispatched or posted.** Same pattern as the author's same-morning slang
filings [project_13906_wgsl_comparison_sampling_non_depth_texture](project_13906_wgsl_comparison_sampling_non_depth_texture.md)
and [project_13924_wgsl_metal_fragment_return_semantic](project_13924_wgsl_metal_fragment_return_semantic.md):
a human filed the issue with their own fix PR, so bot triage or a fix would duplicate it, and R6
(#13596) has the bot wait on human issues. Related but not dependent: Metal DescriptorHandle work in
[project_10842_metal_descriptorhandle_runtime](project_10842_metal_descriptorhandle_runtime.md) and
[project_13900_metal_top_level_descriptor_handle_layout](project_13900_metal_top_level_descriptor_handle_layout.md).
A #1242 `pr_ready_for_review` webhook to `slangpy-pr-approver` still needs the paused check
([pr-approvers-paused](../pr-approvers-paused.md)).

**Resume on:** an `@nv-slang-bot` mention on #1241/#1242, or an operator ask. No timer.
