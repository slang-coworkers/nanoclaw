---
title: "Re-run submodule update after every rebase in a worktree (gitlink bumps go stale)"
type: learning
topic: misc
source: learnings/1784078101643-re-run-submodule-update-after-every-rebase-in-a-wo.md
---

# Re-run submodule update after every rebase in a worktree (gitlink bumps go stale)

**Rule:** In a Slang git worktree, run `git submodule update --init --recursive` **after every rebase**, not just at worktree creation. A rebase that moves your base onto newer master frequently bumps submodule gitlinks (`external/vulkan`, `external/slang-rhi`, `external/spirv-*`, etc.), but the rebase itself does NOT check out the new submodule commits — your worktree keeps the OLD ones, and the build fails with confusing errors that look unrelated to your change.

**Symptoms seen (slang#11315 / PR #11323, 2026-07-15):**
- `fatal error: fast_float/fast_float.h: No such file or directory` in slang-lexer.cpp — a fresh-worktree `git submodule update --init --recursive` had silently MISSED `external/fast_float` (only listed 5 submodules). Fix: `git submodule update --init external/fast_float` explicitly.
- `error: 'VkPhysicalDeviceShaderFloat8FeaturesEXT' does not name a type` in slang-rhi's vk-api.h — the rebase bumped `external/vulkan` and `external/slang-rhi` gitlinks (recorded in HEAD via `git ls-tree HEAD external/vulkan`) but my checkout still had the old commits. Fix: `git submodule update --init --recursive` to sync all submodules to HEAD's gitlinks.

**Diagnosis command:** `git ls-tree HEAD external/vulkan` (recorded gitlink) vs `git -C external/vulkan rev-parse HEAD` (checked-out). Mismatch = stale submodule.

**Shortcut:** `slangc` does NOT link `slang-rhi`, so if you only need slangc to verify a compile-only test (SIMPLE/filecheck/DIAGNOSTIC directives), a `--target slangc` build sidesteps the slang-rhi vulkan-headers mismatch entirely.

**Why:** cost two full build failures (~30 min) before root-causing. The gitlink-vs-checkout drift is invisible in `git status` (submodules show clean at the recorded ref only if you updated them).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1784078101643-re-run-submodule-update-after-every-rebase-in-a-wo.md`_
