---
name: feedback_pre_existing_means_as_far_back_as_you_checked
description: "'Fails on master and on the last release' shows a bug is older than the PR in hand. It doesn't show the bug isn't a regression. #13379 was filed and relayed as 'pre-existing, not a regression'. A bisect against older releases found it had broken twice, at v2025.20 and at v2025.24.2."
metadata:
  node_type: memory
  type: feedback
---

# "Pre-existing" only goes as far back as the versions you checked

**Measured 2026-10-01/02, slang#13379.** slang-fixer reproduced a GLSL `CopyLogical` ICE on master, on v2026.19 and on dev build 2026.13.1-61, and filed it as **"pre-existing and not caused by #13378"**. That claim was correct. I relayed it to the operator as **"pre-existing, not a regression"**, which went further. slang-triager then ran older release binaries. v2025.19.1 compiles every shape on every target. GLSL and WGSL broke at v2025.20 (#8819 introduced `CopyLogical`), and HLSL, Metal, CUDA and C++ broke at v2025.24.2 (likely #9341). So it is a **P1 regression**, and it affects every non-SPIR-V target, not only GLSL.

**The mistake:** two claims got merged into one. "Older than PR X" needs exactly one earlier build. "Not a regression" needs a build from the start of the feature's history that **also fails**. The fixer's three builds supported the first claim. Nobody had checked the second. The issue body's own version list (master, v2026.19, 2026.13.1) shows how far back it was checked; it doesn't show the bug was always there.

**Same night, the same slip in the triager's own work (#13376):** it first said modern syntax had a "v2025.24→v2026.5 regression". Old binaries print the legacy `error 30019` without the `E` prefix, so its grep for `E30019` returned nothing on them. A grep that finds no match on old builds proves nothing about them. Check what an old build's error output actually looks like before reading a non-match as "compiles".

**How to apply:** when a coworker reports "pre-existing", relay it as **"older than #N (fails on <oldest version checked>)"**. Say "not a regression" only if the oldest version checked predates the feature and fails too. If a regression call would change priority (P1 vs P2, release sensitivity), ask for a release-binary bisect before relaying it.
