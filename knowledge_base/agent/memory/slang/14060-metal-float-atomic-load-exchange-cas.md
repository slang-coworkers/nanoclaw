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

**11-02 12:22Z (from the #14153 chain).** Human PR **#14170** (albertrodriguezclo, "Fixes #14153") conflicts textually with `fix/issue-14060`: it calls `diagnoseFloatAtomic` from `emitAtomicOp`, and #14060 renames that lambda. I told owner fixer `ytzi3p` (pinned, seq 44) to state the conflict in the 22:05Z draft PR and to rebase if #14170 merges first. **When checking the draft after 22:05Z, also check that the PR description mentions #14170.**

**11-02 12:24Z, fixer ack.** Another chain sent a heads-up (not from this session) that open non-draft PR **#14170** (head `24c894f11`)
moves `diagnoseFloatAtomic` above `emitAtomicOp` and calls it on the texture path. It also checks the old E55204 text in
`tests/hlsl-intrinsic/texture/float-atomics.slang`. The fixer put a conflict section in its `memory/fix-14060.md`; the `t-0e0a49` prompt reads it first.
If #14170 lands first, the plan is: merge master, keep one lambda, no double E55204 on the texture path, update #14170's test message.
Nothing is pushed; the 22:05Z time is unchanged. The run will not comment on #14170.

**11-02 22:02Z: R6 ended; triage comment posted.** issuecomment-6589572152 at 22:01:56Z. I verified it is the only comment.
jhelferty-nv assigned **jkwak-work** at 18:44Z (assignee verified; no comment). Next: the fixer's `t-0e0a49` opens the draft PR at about 22:05Z.
The triager then edits 6589572152 in place to add the PR link.

**11-02 22:37Z: draft PR #14210 opened** (22:06Z, head `85e32a28b`, `pr: non-breaking`, `Fixes #14060`; I verified it live).
The triager edited issuecomment-6589572152 in place with the PR link. ⚠️ **The PR mapping points at the fixer's one-shot task session**
`sess-1793316801220-5f63gx` (`system:tasks:t-0e0a49`), not the chain session `ytzi3p`. That is first-claim-wins, as on #14037/#14058,
and I did not request a remap. CI run 41536440200 has the usual bot-draft shape: `wait-for-human-priority` and `check-ci` failed, and every build was skipped.
So there is no CI evidence, including the Metal legs. `license/cla` is pending (nit-patch commit a70747f88 has the nv-slang-bot identity; not required).
Possible conflicts: #14170 and #14044. **PARKED** on a human ready-flip or review (assignee jkwak-work). My one-shot re-check
`recheck-14210-human-6a1f-ddb2` runs 11-06 22:00Z. The operator's R6×PR question no longer matters for this chain, but the policy question is still open.

**11-05 01:13Z: READY + maintainer review; webhooks were stranded in a closed session.** jkwak-work left 6 inline comments
(11-04 23:12–23:22Z): five say to add a newline before "On WGSL, " in `hlsl.meta.slang` (:12829/12872/12895/12924/12954), and
r4474605900 at `slang-emit-metal.cpp:349` asks "Should we check this in `slang-ir-check-unsupported-inst.cpp` ?". The review was
COMMENTED (23:22:33Z), and they flipped the PR ready at 23:22:43Z. The PR-mapped session `5f63gx` is **closed**
(container stopped). It got the webhooks as seq 20–30 `in` rows with no `out` row, so nothing was read for about 2 h. I relayed
the comments verbatim, pinned to chain session `ytzi3p` (msg 25, landed as its seq 62, and it is now running). I requested
`pr-mappings remap` #14210 → `ytzi3p` (approval pending). Until it lands, relay #14210 webhooks to `ytzi3p` by hand.
CI after the flip: 56 pass, 0 fail, 1 pending (license/cla). The macOS build and test legs pass, which is the first real Metal check. #14170 and #14044 are still open.
The `ready_for_review` webhook was NOT forwarded to slang-pr-approver (paused); the entry is in `data/approver-pause-queue.md`.
I repointed re-check `recheck-14210-human-6a1f-ddb2` (11-06 22:00Z) at `ytzi3p`.
**Lesson:** when a release one-shot task session opens a PR, it holds the first-claim mapping. After the task ends, that session
closes, and later human webhooks go nowhere. On the first human event, check `ncl sessions get <mapped sid>` for `closed`.

**11-05 01:25Z: jkwak-work's review (11-04 23:22Z, COMMENTED, 6 comments) has been answered** (fixer [Report]; I verified it live).
#14210 is **out of draft**; jkwak-work did the ready-flip at 11-04 23:22Z (a sibling Main session relayed it to ytzi3p at 01:13Z). Head `3556907fe` (fast-forward push; it splits the "On WGSL" sentences in the 5 `hlsl.meta.slang` remarks), MERGEABLE.
Comments 1–5 are done. **Comment 6 is parked on jkwak-work** (bot reply r4475471986): option (1) move the float check into
`checkUnsupportedInst` in this PR, which needs care because the pass is skipped under `-minimum-slang-optimization`; or option (2) move all the Metal atomic checks in one follow-up.
The fixer recommends 2. The PR mapping now points at the chain session **`sess-1793311990079-ytzi3p`** (a fresh `report_pr_created`).
CI run 41948210276 on the new head is `waiting`. I updated the prompt of re-check `recheck-14210-human-6a1f-ddb2` (still 11-06 22:00Z) to this state.

**11-05 ~01:2xZ:** the remap landed, so #14210 now maps to `ytzi3p` (01:23:38Z) and webhooks route to it directly; manual relays are no longer needed. The fixer pushed head `3556907fe7`, which fired a synchronize `ready_for_review` event. That event was not forwarded because the approver is still paused, and the queue entry's on-unpause note already says to read the live head.

**11-05 05:16Z: jkwak-work chose to move the check (verified, r4476809966):** "I still want to move to checkUnsupportedInst. The other
checks in metal emit should also move to an earlier stage unless there is a strong reason not to." The fixer (r4476865732)
committed to moving the float check and 2 other atomic checks into `checkUnsupportedInst`; the Metal checks still run under `-minimum-slang-optimization`.
It asked whether the 3 non-atomic checks (precise, 2 coop-matrix) belong here or in a separate PR. Now implementing; no force-push.
Watch for scope overlap with #14044 and #14170 (both add atomic checks to the emitter). I rewrote the re-check prompt to this state.

**11-05 07:41Z: the move to `checkUnsupportedInst` is pushed.** Head `040306d`; the fixer sent an explain-diff HTML:
`/workspace/inbox/a2a-1793864469915-3wbs3e/2026-11-05-shader-slang-slang-pr14210-metal-float-atomics-checks.html`. Next: jkwak-work re-reviews.
Fixer [Report] 07:41Z: `3556907fe..040306dd5`, fast-forward. The Metal float-atomic, both texture-atomic and the coop-matrix checks now live in
`checkUnsupportedInst`, which is always called with a check set, so the Metal checks also run under `-minimum-slang-optimization`. The `precise`
warning stays in the emitter, because the C++, WGSL and Metal emitters share it; jkwak-work was asked about a follow-up (r4477792073). Full suite 11415/11418, the 6 directories after the coop
commit 2841/2844 (only the 3 fp8-cuda), unit tests 664/664. The 300-file/698-run metal diagnostic diff is identical. ⚠️ I found **`CONFLICTING`** at
040306dd5 (#14170 and #14044 are still open). At 07:4xZ I told the fixer (msg 63) to merge master, without rebasing or force-pushing, then re-test and report.
**11-05 07:51Z: master merged** → head `dbf1f7d00` (a merge commit, no force-push). There was one conflict, in `tests/compute/atomics-invalid-dest-type.slang`
(master #14269 needs `exit-code=-1` on SIMPLE tests that expect errors). metal+hlsl-intrinsic 915/915; the PR's 8 files 31/31; diagnostics+compute+coop
1834/1837 (only the fp8-cuda failures). The fixer reports MERGEABLE and BLOCKED only on review; I checked it live. Next: jkwak-work re-reviews and answers the `precise` question.

**11-05 18:14Z: jkwak-work reversed the always-run part** (r4484016682: `checkUnsupportedInst` is validation that may be skipped for
input known to compile; r4484055762: "keep the previous implementation"). New head `7e7e4c3dc` (fast-forward). `slang-emit.cpp` is identical to master again,
and `UnsupportedInstCheckSet` is gone. The Metal checks stay in `checkUnsupportedInst`, so they **do not run** under `-minimum-slang-optimization`. The fixer
disclosed the side effect: a saturating coop-matrix MAD then silently compiles as plain `simdgroup_multiply_accumulate`. The 5 error runs under that flag were removed,
and one valid compile run was added. Tests: 27/27, 2745/2748 (only fp8-cuda), unit 679/679. jkwak-work resolved the 5 WGSL threads.
The `precise` question is still open. **Lesson:** this maintainer treats `checkUnsupportedInst` as skippable validation, so don't propose forcing it to run.
Verified live 18:1xZ: head 7e7e4c3dc, MERGEABLE, mergeStateStatus **BEHIND** (master moved again). Review is still the blocker; the fixer can merge master when re-review lands.
**11-05 19:21Z:** jkwak-work resolved all 7 threads (5 WGSL, the checkUnsupportedInst thread, the slang-emit.cpp guard thread). The `precise` thread was resolved without an answer, and the fixer reads that as leave it (no follow-up unless asked). Head `7e7e4c3dc`, no approval yet. **PARKED on jkwak-work's approval + CI.** Re-check `recheck-14210-human-6a1f-ddb2` 11-06 22:00Z.
**11-05 19:22Z: APPROVED by jkwak-work** (pullrequestreview-5790721079, verified) at 7e7e4c3dc. CI 51 pass / 0 fail / 4 pending (Win debug GPU test-slang, Linux sm80 test-slang, Falcor build, license/cla). BEHIND. master **has a merge queue** (verified live; branch rules are only deletion/non_fast_forward/copilot_code_review), so I told the fixer not to merge master; merge only if the queue evicts the PR for a conflict. Waiting on a maintainer to enqueue.

**✅ TERMINAL 11-05 21:53:54Z: #14210 MERGED** by jkwak-work as `37fc7aa7d`. Issue #14060 is CLOSED/COMPLETED (verified live). The fixer
cleaned up the worktree and sentinel. I cancelled re-check `recheck-14210-human-6a1f-ddb2`.
Follow-ups: #14170 is the reporter's own PR (albertrodriguezclo), and the bot does not comment there (see #14153's record). #14044 is the bot's draft
(Fixes #14031), owned by fixer session `sess-1793291446093-uqb9b4`. At 21:56Z I sent that session a pinned heads-up (msg 85; it landed as seq 24, verified):
merge master, then move the 64-bit check into `checkUnsupportedInst` following jkwak-work's direction, quoted verbatim. Not filed: SPIR-V float CAS fails spirv-val, half/double Metal atomics.
