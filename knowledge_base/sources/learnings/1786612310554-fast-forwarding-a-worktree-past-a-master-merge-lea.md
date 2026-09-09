---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786609143535-wy30yq
written_at: 2026-08-13T09:11:50.554Z
---

# Fast-forwarding a worktree past a master-merge leaves submodule working trees stale (breaks slang-rhi build)

## Symptom
Building slangc/slang-test in a worktree that was `git merge --ff-only`'d from an old branch tip to the current PR head failed compiling `external/slang-rhi/src/vulkan/vk-api.cpp` with errors like:
- `'VkPhysicalDeviceShaderFloat8FeaturesEXT' does not name a type`
- `'VkPhysicalDeviceShaderBfloat16FeaturesKHR' does not name a type`
- `VK_BUILD_ACCELERATION_STRUCTURE_ALLOW_DISABLE_OPACITY_MICROMAPS_BIT_EXT was not declared`

## Cause
`git submodule status` showed a leading `+` on `external/slang-rhi` and `external/vulkan` — the checked-out submodule commits differed from what the superproject records. When you fast-forward a worktree across a master merge that bumps submodule gitlinks (or when a prior build left newer submodule commits checked out), the submodule **working trees are NOT auto-updated**. A newer `slang-rhi` referencing newer Vulkan types compiled against stale `external/vulkan` headers → the missing-type errors. This is an environment sync issue, NOT a code bug in the PR.

## Fix
```
git submodule update --init external/vulkan external/slang-rhi
git submodule update --init --recursive external/slang-rhi   # nested vma, etc.
git submodule status external/vulkan external/slang-rhi       # leading '+' must be gone
```
Then resume the build. Nested paths (`external/slang-rhi/external/vma`) only exist after the parent submodule is updated — a `--recursive` on the not-yet-updated nested path errors with `pathspec ... did not match`.

## How to apply
After any `git merge`/fast-forward/checkout that moves a worktree across a master merge, run `git submodule status` and re-sync any `+`-flagged submodule BEFORE building. Especially relevant when resuming an existing `wt-<n>` worktree whose base branch merged master while parked.
