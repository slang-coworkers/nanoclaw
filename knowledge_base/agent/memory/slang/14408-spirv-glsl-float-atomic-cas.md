---
type: chain
title: slang#14408 — SPIR-V/GLSL Atomic<float|half|double>.compareExchange emits integer-only CAS on a float type
description: Human-filed (albertrodriguezclo) 2026-11-08 10:07:41Z. Draft PR #14412 @ c0c1dd807: R1 APPROVE_WITH_NITS applied, [Fix Report] 12:07Z. Waiting on maintainer review; ready-flip on the weekly list. Triaged bug/high/P2 10:20Z; fixer fu0349 on canonical thread (approach A, diagnostic + BAB uint view). Side issue #14410 bot-filed and owned here, so it needs no dispatch.
tags: [spirv, glsl, atomics, float, compare-exchange]
---

# slang#14408 — SPIR-V/GLSL float `compareExchange`

**Ask.** `Atomic<float>.compareExchange` (also half/double) emits `OpAtomicCompareExchange %float`
on SPIR-V (spirv-val: result type must be an integer scalar) and `atomicCompSwap(float…)` on GLSL
(glslang: no matching overload). The NVIDIA driver crashes in render-test, and slang-test then hangs
in its retry phase. HLSL is fine (`InterlockedCompareExchangeFloatBitwise`). The reporter suggests a
bitcast to a same-width uint around the CAS, or a diagnostic.

**Related (do not merge):** #14060 triage listed "SPIR-V float CAS fails spirv-val" as an unfiled side
finding; this is that issue, filed by the reporter. Reporter PR #13938 (WGSL Atomic<float> → CAS loop
on atomic<u32>) is the WGSL precedent. #14054/#14404 (Metal weak CAS) are separate.

**Dispatch 2026-11-08.** Webhook Main `sess-1794132463758-thhk08` → slang-triager, thread
`gh-issue-shader-slang/slang-14408`. Pre-checks: no memory hit, events empty, no comments.

**Side finding filed 2026-11-08 10:19Z:** [#14410](14410-hlsl-cuda-atomic-half-double-cas.md)
(HLSL/CUDA half/double CAS) by this chain's triager. This chain owns it; the triage report decides
whether the fixer bundles it.

**Triage (slang-triager `sess-1794132561423-uz9kum`, 11-08 10:20Z; these are the triager's findings).**
bug/high/target-emit/P2, reproduced on ae4e57957. Labels `reproduced` + Type=Bug verified live 10:2xZ.
Wider than reported: the HLSL-compat `InterlockedCompareExchangeFloatBitwise` (free function and the BAB
method) and `groupshared Atomic<float>` are also broken. A value-only bitcast is not enough: spirv-val rejects
`OpBitcast` on a logical pointer. Recommended A: a float-CAS diagnostic for Khronos targets in
`slang-ir-check-unsupported-inst.cpp` (next to the #14210 Metal check), plus the BAB `…FloatBitwise` methods
moved to the uint view (`hlsl.meta.slang:7509/7575`). B (re-view the storage as uint) is a follow-up only.
C (#13938-style) and D (pointer bitcast) are rejected. Overlap: PR #14170 touches the same file; keep the PRs independent.
Linux `-vk` gets a driver SIGSEGV in-process and a clean FAILED with `-use-test-server`; the hang looks Windows-only.
Memo: `/workspace/inbox/a2a-1794133236377-q5uzl3/triage-14408.md`.
Triage comment [6720294739](https://github.com/shader-slang/slang/issues/14408#issuecomment-6720294739) (nv-slang-bot 10:21:18Z).
Fixer: slang-fixer `sess-1794133237567-fu0349` on the canonical thread (handed off by the triager, 10:20Z); acked 10:21Z, worktree `wt-slang-14408` on `fix/issue-14408` @ ae4e57957.

**Side issue #14410 (bot-filed by the triager, 11-08 10:19:47Z):** HLSL/CUDA `Atomic<half|double>.compareExchange`
emits overloads that DXC and NVRTC reject. **Owned by this chain, so its issue_opened needs NO dispatch.** No fixer chain
has been started for it; that is up to the operator.

**Draft PR #14412 (11-08 ~11:12Z).** Head 84f7b28bf on `fix/issue-14408`, `pr: non-breaking`, `Fixes #14408`. The pr-mapping
points to fixer fu0349 (verified). Approach A: E55204 for float CAS on Khronos targets, BAB FloatBitwise via the uint view.
2 tests; Vulkan/CUDA run on L40S. The fixer reports 4 full-suite failures and calls them unrelated host failures
(fp8 CUDA PTX JIT, slang-llvm); this is the fixer's claim and I have not checked it. Issue 5-bullet: cmt 6720824695.
Fixer milestone 11:26Z (fixer's figures): new tests 9/9, targeted dirs 1408/1408, full suite 11902/11906 (4 host-only). CI run 42474723844. [Fix Review Request] sent to slang-reviewer.
Next: the fixer's peer review → [Fix Report]. The ready-flip is pending (weekly list; this is not a P0/P1 or a regression).

**R1 review (slang-reviewer `r3oi4b`, 11-08 11:57Z): APPROVE_WITH_NITS**, 0 bugs, 0 gaps. Apply nits N1–N7 (`pr14412-r1-nits.patch`)
with no re-review. The min-opt skip is accepted per jkwak-work's #14210 ruling. Review file:
`/workspace/inbox/a2a-1794139057377-burltl/combined-review.md`. The fixer has the review, patch and verdict (seq 16/18/20).
Side find S1 (WGSL `Atomic<float>` emits `atomic<f32>` for any op) **is already covered by the reporter's open PR #13938**, which closes
no issue. I told the fixer at 11:58Z (seq 22, pinned, in_reply_to=2) not to file it.

**[Fix Report] 11-08 12:07Z (fixer's figures).** Nits applied: f50b70d43 (docs/comments) and c0c1dd807 (run-time-value BAB test). PR head
c0c1dd807 and still a draft (verified). 6 files, +231/−11, 3 new tests, 12/12 lanes on L40S, targeted 1411/1411. CI run 42478181080.
S1 was not filed (covered by #13938). Out-of-scope follow-up the fixer noted: the BAB FloatBitwise `[require]` asks for int64 atomics
it does not need.
**State: waiting on maintainer review; the ready-flip is on the weekly list.**
