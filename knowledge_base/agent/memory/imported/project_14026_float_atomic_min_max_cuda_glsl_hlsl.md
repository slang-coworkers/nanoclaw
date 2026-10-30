---
type: project
name: project_14026_float_atomic_min_max_cuda_glsl_hlsl
description: "slang#14026 (albertrodriguezclo, external, 10-29 16:18Z): float InterlockedMin/Max emit invalid CUDA/GLSL/HLSL. Triaged 16:34Z (bug/medium/P2, three emitter gaps). Fix Report 21:12Z: 3 draft PRs #14046 GLSL / #14047 HLSL / #14048 CUDA, reviewer APPROVE_WITH_NITS, nits applied. PARKED on maintainer review + human un-draft + CI (skipped while draft). Timer recheck-14026-maintainer-6eb1, 11-02 14:00Z."
---

# slang#14026: float `InterlockedMin`/`InterlockedMax` emit invalid CUDA / GLSL / HLSL

**Report (the issue):** the calls compile with no Slang diagnostic on CUDA, GLSL and HLSL, and then
NVRTC, glslang and DXC reject the output. SPIR-V is valid. Metal (E55204) and WGSL (E36107)
already report an error. The reporter ports a cloth simulator that has 30+ such calls.

**Chain (all on the canonical thread `gh-issue-shader-slang/slang-14026`):**
- Webhook Main `sess-1793290699785-o20wen` dispatched it to slang-triager at 16:18Z.
- Triager session `sess-1793290817173-8665tz`: the [Triage] at 16:34Z reproduced every claim at
  9b3ac252d, classified it bug/medium/target-emit/P2 (not a regression), applied the `reproduced` label + Type=Bug, and
  posted issuecomment-6502500450. Memo: `/workspace/inbox/a2a-1793291666225-p391wg/triage-14026.md`.
- Fixer session **`sess-1793291589507-vskx9v`** owns all three PRs. The pr-mappings were verified at 20:26Z.
- The slang-reviewer gave APPROVE_WITH_NITS on all three PRs at 20:26Z. One disagreement was
  settled as by-design: under `-fp-mode fast`, a stored subnormal ties with zero.

**PRs (the 21:12Z [Fix Report], checked live; each one is "Part N of 3" and none auto-closes the issue):**
| PR | target | head | assignee / review requested |
|---|---|---|---|
| #14046 | GLSL `requireAtomicExtIfNeeded` → `GL_EXT_shader_atomic_float2` for min/max and every scalar half atomic | c416ff9 | kaizhangNV |
| #14047 | HLSL E55204 for float min/max and half/double add/sub | 0a3a415 | jkwak-work |
| #14048 | CUDA prelude CAS loop `__slang_atomic_min_max<T,Bits>` with `OpAtomicFMinEXT` rules; half raises SM to 7.0 | 2c498ea | jkwak-work |

All three are drafts labeled `pr: non-breaking`. The CI/format/label runs are `skipped` while
the PRs are drafts, so GitHub CI has not tested any of them. The fixer reports that the full suite
was **not** rerun on the final heads. The reviewer's 11076/11079 run used the pre-nit heads, and its
3 `fp8-cuda*` failures were also seen on master on 10-28.

**Unfiled follow-ups (operator asked 10-29 whether to file them; held for fan-out control):**
1. float `InterlockedAnd/Or/Xor` accept float through `IArithmeticAtomicable` and emit invalid HLSL with no diagnostic.
2. slang-rhi `vk-device.cpp:832-840` enables `VK_EXT_shader_atomic_float2` only when
   `shaderBufferFloat16Atomics` is set, so float min/max loses the device on the L40S.
3. The SPIR-V min/max block in glsl.meta names the extension `_float_add`. The direct emitter hides this.
4. On Metal, any `StructuredBuffer<double>` crashes with E99997.
(Out of scope: invalid WGSL `atomic<f32>` is already covered by PR #13938.)

**PARKED** on maintainer review, human un-draft (ready_for_review is human-only by norm), and CI.
Timer: one-shot `recheck-14026-maintainer-6eb1`, 11-02 14:00Z. The operator was told on orchestrator-dashboard on 10-29.
The three PRs are independent; if one lands and another conflicts, update by MERGE from master,
never by rebase ([feedback_update_reviewed_pr_by_merge_not_rebase](../feedback_update_reviewed_pr_by_merge_not_rebase.md)).

**10-29 21:5xZ: reporter comment 6509184963 (no bot mention, so not post-authorized).** The reporter measured a sign-split
integer-atomic lowering at ~2× faster than the CAS loop under heavy contention (RTX 4060 Ti, sm_89) and suggests it, plus a NaN guard,
for #14048. It notes `-0.0` < `+0.0` ordering, and that a Metal CAS loop is unsafe because of weak CAS (#14054). This came from the
reporter, not a maintainer. I relayed it verbatim to fixer `vskx9v` (pin + `in_reply_to=34`, my webhook row), and it landed at fixer
seq 44. Resume on: the fixer's decision on this thread.

**10-30 01:22Z fixer [Report], checked live:** the fixer adopted the sign-split idea in #14048, which is now at head **5e2252a** (still a draft).
Float and double use a load, a NaN-operand ignore, a stored-NaN `atomicCAS` path, an early exit, and one integer atomic. Half stays a CAS loop.
The fixer measured 1.7–2.1× (float) and 1.6–2.0× (double) over the CAS loop on the L40S, with bit-identical results.
The bot replied to the reporter in issuecomment-6512571988 (01:20:59Z). The fixer requested an R2 from slang-reviewer.
#14046 and #14047 are unchanged. **Open maintainer question:** should `reduceMin/Max` skip the return-value check? That gives `red`+`REDUX`
and another 2–3×, but a NaN stored concurrently by an exchange could then survive. Not changed. Resume on: the reviewer's R2 → maintainer review.

**10-30 01:50Z reviewer R2 on #14048 @ 5e2252a:** APPROVE_WITH_NITS, 0 bugs. Integer path verified by trace and on the L40S (262K-op linearizability and a concurrent ±NaN race, with no NaN surviving).
The one gap: the max-with-negative-operand branch is never executed by the test. The reviewer sent a tested remedy, plus an optional patch that makes the early exit exact under FTZ. Suite 11094/11097 (the 3 known fp8-cuda).
Sent to the fixer as well. Resume on: the fixer applies the nits → maintainer review.

**10-30 02:04Z [Fix Report] R2:** #14048 is at head **eded196** with the R2 nits applied. The early exit now compares integer keys, so it is exact under FTZ and Devin's flag is resolved. Every sign-split branch is tested. cuda+atomic 164/164.
#14046 is at c416ff9 and #14047 at 0a3a415, both unchanged. The open maintainer question (should `reduceMin/Max` drop the post-check?) still stands. **5th unfiled follow-up:** double `InterlockedExchange` on CUDA
fails in NVRTC (there is no `atomicExch(double*)`), on master as well; added to the follow-ups held for the operator. PARKED on human review again; timer 6eb1 unchanged.
