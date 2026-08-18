---
title: "A latent defect's VISIBILITY can toggle independently of the defect — check the validator/env axis before answering 'is it a regression'"
type: learning
topic: misc
source: learnings/1785967034838-a-latent-defect-s-visibility-can-toggle-independen.md
---

# A latent defect's VISIBILITY can toggle independently of the defect — check the validator/env axis before answering "is it a regression"

"Is this a regression?" is usually answered by dating the defective code. That can be right about
the code and wrong about the user's experience, because a defect only manifests through some
*checker*, and the checker's configuration has its own history.

Case (shader-slang/slang#12371): SPIR-V validation ran on a stale pre-link buffer. The ordering
was wrong from the day the feature landed (`063468449`, #6500, 2025-03-05), so "not a regression,
broken in every release" looked obvious. It was false. The observable rejection tracked the
validator's target environment, which changed **twice**:

| change | env in `glslang_validateSPIRV` | pre-link buffer | normal releases |
|---|---|---|---|
| #6500 added the link | `SPV_ENV_VULKAN_1_3` | INVALID | 5 |
| #6893 spirv-tools SDK bump | `SPV_ENV_UNIVERSAL_1_6` | **VALID (masked)** | 35 |
| #8752 "enable Vulkan-SPIRV rules" | `SPV_ENV_VULKAN_1_4` | INVALID | 46 |

A Universal env permits `OpCapability Linkage`; a Vulkan env does not. So for 35 releases the
check passed vacuously — which explains the long silence far better than "the ordering is recent".

Method that settled it, reusable: reconstruct the *rejected bytes* (I assembled the compiler's own
disassembly back to a binary with SPIRV-Tools) and validate them under each historical env, with
the shipped artifact as a control. The control mattered: it was valid under all three, proving the
env axis flips the verdict on the intermediate only and never touched real output.

Rules:
- Date the defect AND the checker. "When did this become visible?" is a different question from
  "when did this become wrong", and users only ever report the first.
- The accurate framing is often compound: *feature-old latent defect whose user-visible failure
  was re-exposed by X*. Publish the phase table instead of forcing a binary yes/no — both halves
  matter to whoever sets priority.
- ⚠️ `git tag --contains <sha> | wc -l` is not a release count: it mixes `vulkan-sdk-*` and
  `-test` tags with real releases. Filter to the release pattern, and check whether the
  lowest-sorting tag is a test tag before calling it "first release" (mine was:
  `v2025.19.1-test-aarch` sorts before the real first release `v2025.20`). State whether unusual
  forms like a four-component `v2026.12.0.1` are in or out of your count.
- A vacuously-passing check is worse than a missing one: it looks like coverage.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785967034838-a-latent-defect-s-visibility-can-toggle-independen.md`_
