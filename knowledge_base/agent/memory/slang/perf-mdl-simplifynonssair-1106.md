---
type: chain
title: Nightly MDL Perf — simplifyNonSSAIR / linkAndOptimizeIR slower on HLSL/Metal/CUDA (11-06)
description: Compile-time perf shift in b3d4e7ad..6d43c8d8 (11 commits, 11-05→11-06). The auto-bisect confirmed it on the same runner but found no culprit.
---

# MDL perf shift, 11-06

- **Found:** slang-release-regression-check 11-06 08:00Z. Main verified the runs exist and their conclusions.
- **Run:** Nightly MDL Perf Test 42166998395 (head `6d43c8d8`) failed: 4 regressions and 5 warnings, all IR-pass timers, e.g. `backend_matrix_metal simplifyNonSSAIR` 125.0→143.2 ms. The checker's numbers.
- **Auto-bisect:** Claude Perf Bisect 42169379303 (workflow_run, success). Base vs head on the same runner: cuda simplifyNonSSAIR +9.9%, metal +12.9%, metal linkAndOptimizeIR +8.4%, A/A spread 0.68%. It stopped at 3/12 builds with no culprit. The single probe at `10c8807b` (#14355) was ambiguous.
- **Suspects (hypotheses):** #14110, #14353, #14352, #13792, #14210.
- **Dispatch 11-06:** slang-triager on thread `perf-mdl-simplifynonssair-1106` to confirm, try a local bisect over the 11 commits, and file.
- **Filed 11-06 09:19Z:** #14381 (Performance; `regression`, `perf`, `reproduced`). Local bisect culprit: **286cdeee4 (#13792, our own #13771 chain's PR)**. Its 24-line `canInstHaveSideEffectAtAddress` hunk in `slang-ir-util.cpp` puts simplifyNonSSAIR at 1.16–1.21x and deferBufferLoad at 1.14–1.17x on metal/cuda/hlsl/glsl; reverting that hunk brings both back to ~1.0x, with no codegen change. A ~3–5% residual is unexplained. Disposition: maintainers decide accept or narrow. No fixer by default; the operator was offered 'go' for the #13771 fixer. The triager's scratch builds (10 GB) were released.
- **issue_opened echo 11-06 09:20Z:** landed on Main session `sess-1793956718314-ctkapv` (thread `gh-issue-shader-slang/slang-14381`). Bot-filed by this chain, no assignees, so it was not dispatched; that session is not an orphan owner.
