---
type: chain
title: slang#14060 — Metal rejects Atomic<float> load/exchange/compareExchange with E55204
description: Human-filed (albertrodriguezclo) 2026-10-29 21:51:55Z, cloth-sim batch. Triaged bug/medium/P2. Fixed locally on fix/issue-14060 @ fd5ab6116; review APPROVE_WITH_NITS (applied). PARKED on R6 until 2026-11-02 21:51:55Z: triager t-6cd00d posts at 22:00Z, then fixer t-0e0a49 opens the draft PR at 22:05Z (both timers verified 10-30).
tags: [metal, atomics, float, e55204, r6]
---

# slang#14060 — Metal `Atomic<float>` load / exchange / CAS → E55204

**Ask.** `diagnoseFloatAtomic()` in `slang-emit-metal.cpp` (the `kIROp_AtomicLoad`,
`kIROp_AtomicExchange`, `kIROp_AtomicCompareExchange` cases) fires for every float operand,
including device-buffer atomics. The reporter says MSL 3.0 §6.15.2 supports `atomic_float` for
these ops, and checked that with Xcode `metal -std=metal3.0`. Texture float atomics remain unsupported.
The CAS path should use the strong (looped) lowering requested in sibling #14054.

**Related chains (do not merge them):**
- #14054 (Metal CAS emits one weak CAS) was filed 27 s earlier. It has its own Orchestrator
  webhook session `sess-1793310695528-xfp82z` and its own dispatch.
- #14026 (float min/max, PRs #14046–#14048, fixer `sess-1793291589507-vskx9v`) is in the same atomics area.
  It does not cover load/exchange/CAS.

**Dispatch 10-29.** Webhook Main `sess-1793310716666-6kskm3` sent the issue to slang-triager on thread
`gh-issue-shader-slang/slang-14060`. Before that there was no triager session and no memory hit.
R6 applies: no `bot-ok` label, and no crash (this is a diagnostic rejection).
The container has no Metal compiler, so any MSL check is by reading the text only.

**Triage (slang-triager `sess-1793310920215-bieivx`, 10-29 22:12Z; these are the triager's findings).**
bug/medium/target-emit/P2, reproduced on 977df1246. Root cause: `diagnoseFloatAtomic`
(`slang-emit-metal.cpp:454`) runs before the `isTextureAccess` branch at :491/546/554. #8117 already
removed the same check for Add/Sub. Spec: Metal 3 `atomic_float` is **device-only**, so the reporter's guess
about threadgroup is wrong. Recommended fix A: an address-space-aware gate (device 32-bit float allowed; textures,
groupshared and half keep E55204). It does not depend on #14054. It conflicts textually with #14044 (the same lambda).
Side findings were not filed: SPIR-V float CAS fails spirv-val, half/double Metal atomics, float atomics on Metal textures.
Memo: `/workspace/inbox/a2a-1793311978164-zz68l4/triage-14060.md`.
Verified live at 22:15Z: `reproduced` label, Type=Bug, 0 comments, no PR.
Fixer session `sess-1793311990079-ytzi3p` is on the canonical thread. The triager's one-shot `t-6cd00d`
(11-02 22:00Z) posts the held 5-bullet.

**R6 × PR ruling (mine, 10-29 22:16Z; the operator may override).** The fixer works locally until
2026-11-02T21:51:55Z. It opens no PR and pushes no commit that names #14060 before then, because either one puts a bot
cross-reference on the issue timeline during the wait. I sent this to the operator as a policy question:
does R6 cover PR/commit cross-references? Precedent: #14026's draft PRs were opened the same day.

**Fix state at 10-29 23:34Z (the triager's [Report]; not verified by me).** `fix/issue-14060` @ b82ef908c, kept local
(worktree `wt-slang-14060`, 3 commits, +206/−19), in peer review. New tests 3/3, metal/hlsl-intrinsic/diagnostics
1898/1898, unit tests 659/659. There are 3 fp8-cuda `CUDA_ERROR_INVALID_PTX` failures; the fixer calls them pre-existing, and the
#14026 reviewer saw the same 3 on master 10-28. Timers: triager `t-6cd00d` posts at 11-02 22:00Z, then the fixer's `t-0e0a49` pushes
and opens the draft PR with `Fixes #14060` at 22:05Z. #14044 will need a textual rebase.

**Review R1 (slang-reviewer, 10-30 00:28Z, patch mode, 9289bd502 on 977df1246): APPROVE_WITH_NITS, 0 bugs.**
Full suite 11084/11087. The 3 fp8-cuda failures also fail on base 977df1246 (0/3), which settles the pre-existing question.
All 3 revert drills are caught. A nit patch `remedy-14060-r1.patch` went to the fixer. Notes for the PR: the conflict with #14044, and the Risk line
on float vector-lane exchange/CAS now emitting `&v[i]` (#13551/#13561). Review file:
`/workspace/inbox/a2a-1793320125803-m8xhfn/combined-review.md`. Candidate follow-ups were not filed (fan-out held, as on #14026):
the `RWTexture<float>.InterlockedAddF32` Metal path emits invalid MSL, and float Store/Add/Sub/bitwise ops on Metal have no gate.

**[Triage Resolution] 10-30 00:57Z.** Fixed locally, `fix/issue-14060` @ `fd5ab6116` (5 commits, +218/−19),
with the nits applied. The helper `getUnsupportedFloatAtomicReason` mirrors #14044's naming. The issue still reproduces on master 1f0b33b86.
The fp8-cuda failures also fail on clean 977df1246 and 1f0b33b86. No Metal compiler has checked the output yet; CI's Metal legs are the first real check.
Timer task sessions verified 10-30: `t-6cd00d` → `sess-1793311914259-kcm1qs` (triager), `t-0e0a49` →
`sess-1793316801220-5f63gx` (fixer). **Next for me:** after 11-02 22:05Z, check that the draft PR exists and that `report_pr_created` was called.
Also watch for the operator's R6×PR answer (asked on orchestrator-dashboard, thread gh-issue-shader-slang/slang-14060).
