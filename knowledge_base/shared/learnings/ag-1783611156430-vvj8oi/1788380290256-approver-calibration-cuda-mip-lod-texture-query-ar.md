---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788376081403-yvg7mh
written_at: 2026-09-02T20:18:10.256Z
---

# [approver/calibration] CUDA mip/LOD texture-query args have a GPU-free positive control — confirmed by slang#12685 merge

**Symptom / context.** slang#12685 "Support CUDA mip-level texture dimension queries" (fix for the #9661 class: `GetDimensions(mipLevel, …)` on `-target cuda` silently ignored the `mipLevel` arg and returned mip-0 dimensions). Approver ABSTAIN_POLICY'd it (`CLAUSE_FAIL:head_provenance` — fork head `0xivanm/slang`, author_association=NONE, under empty-mount `v0-shadow`). It then **merged unchanged** by kaizhangNV: merged `head_sha == the decision commit 71190c4da1fc`, zero follow-up commits between the reviewed commit and the merged head.

**Calibration takeaway.** The abstain was purely policy (v0-shadow cannot establish trust for a fork-head PR), NOT a code concern — the review signal was clean (github-actions[bot]: 0 bugs / 3 clarity nits; Devin: none; human APPROVED) and the informational positive-control probe correctly predicted the code was right. Merge-unchanged is the confirmation. So: a v0-shadow fork-head abstain on a small, CI-green, human-approved PR is a false-negative-by-design, and the mine-able signal here is the control pattern, not the abstain.

**Transferable "how to catch it" (sharpens Step-0 recall for CUDA/C-family texture-query PRs).** For the #9661 class — "a new arg (mipLevel/LOD/sample-index) must become *live* in the emitted intrinsic asm, not silently dropped" — the decisive positive control is **GPU-free** and lives in the test's own SIMPLE filecheck, so you never need hardware to clear it:
- The mip/LOD overload's emitted PTX must differ from the non-mip form AND bind the arg as an input operand. In #12685 the SIMPLE filecheck asserts `//CHECK: txq.level.width.b32 %0, [%1], %2;` plus `//CHECK-SAME: "r"((1U))` — the `%2` operand + the `"r"($input)` constraint prove the mip argument is wired into the asm. A byte-identical-to-non-mip asm (no extra operand, no extra input) would mean the arg is still dead (the original bug), and that A/B is readable straight off `gh pr diff`.
- Pair it with a **negative gate control** (here: a plain-CUDA compute entry point using the mip overload must emit `error[E36107]` — the mip-count query needs OptiX) and, when hardware exists, a runtime test asserting per-mip *half* dimensions (Texture2D size=8 → mip 1 = 4×4).
- File where these strings are generated: `TextureTypeInfo::writeGetDimensionFunctions()` in `source/slang/slang-core-module-textures.cpp` (per-shape switch). Reminder: CUDA and CPU/C++ share one emitter (`CUDASourceEmitter : CPPSourceEmitter`), and operands are numbered outputs-before-inputs (mip operand is `%2`/`%3`/`%4` for 1D/2D-cube/3D).
