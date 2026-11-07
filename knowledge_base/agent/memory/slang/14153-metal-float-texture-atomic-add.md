---
type: chain
title: slang#14153 — Metal `RWTexture2D<float>.InterlockedAddF32` emits non-existent `texture2d<float>::atomic_fetch_add`
description: Human-filed (albertrodriguezclo) bug 2026-11-02 10:04:25Z. Float texture atomic add on Metal emits a member MSL lacks. Triaged P2 (regressed in #8117); a bot fix was built locally (stacked on #14060). DEFERRED 12:22Z to the reporter's own PR #14170; the bot branch is never pushed and the held comment is cancelled. r6-release-14153-5235 ran 11-06 with no action (#14170 open; jkwak-work assigned).
tags: [metal, emit, atomics, texture, float-atomics, r6]
---

# slang#14153 — Metal float texture `InterlockedAddF32`

**Ask.** MSL texture atomics exist only for `int`/`uint` textures (plus `ulong` min/max).
`RWTexture2D<float>.InterlockedAddF32` passes the Metal capability check and emits
`t.atomic_fetch_add(coord, vec<float,4>(1.0f)).x`; Apple's compiler rejects it ("no member named
'atomic_fetch_add' in 'metal::texture2d<float, metal::access::read_write>'"), on metal3.1/3.2/4.0. slangc exits 0.
Other float texture atomics already get the "floating point atomic operation" diagnostic
(`tests/metal/atomic-texture-buffer.slang -DFLOAT`); `InterlockedAddF32` bypasses it. The repo test
`tests/hlsl-intrinsic/texture/float-atomics.slang` (`-target metal` lane, `// MTL: atomic_fetch_add`) passes
on text only. Expected: a diagnostic, or a CAS-loop emulation on a `uint` view of `r32float`.
Toolchain: master `6815ed82d`, Xcode 26.5, M4.

**Related (not owners).** #14031 / draft PR #14044 (Metal 64-bit atomics, same reporter, `slang-emit-metal.cpp`
area); [#14058](14058-metal-discarded-atomic-unused-variable.md) (Metal atomic temps, local fixer branch, conflicts
with #14044); [#14054](14054-metal-weak-compare-exchange.md) (Metal CAS strength — matters if emulation is chosen);
#12505 (D3D arm of `InterlockedAddF32`, NVAPI-only).

**Dispatch (11-02, Orchestrator).** Memory grep on 14153: only incidental number hits. The only session on
`gh-issue-shader-slang/slang-14153` is my own webhook session (sess-1793613868075-q42tdv). GitHub dup search
("InterlockedAddF32", "metal atomic float texture"): no duplicate. Labels none; fenced blocks but no crash word
(compile error, not a crash), so the **R6 hold applies until 2026-11-06T10:04:25Z**: no bot comment, label, PR or
commit naming the issue before then; a fixer works locally only. Release timer: Main's `r6-release-14153-5235`
(11-06 10:09Z); the triager was told not to set its own.

Triager session `sess-1793614086392-h2h06c` (msg id 17, 10:08Z). 10:08Z progress (triager msg 20): reproduced locally at 6815ed82d (slangc exit 0, same `atomic_fetch_add` emit); tracing why the float-atomic diagnostic is bypassed. No GitHub writes.

**10-09Z cause (triager msg 22; triager's finding).** Not a lowering path: texture `InterlockedAddF32`
(hlsl.meta.slang ~:28770) declares Metal support and has an explicit `case metal: __atomic_add(this[coord], …)`;
the emit-side float check in `slang-emit-metal.cpp` covers load/exchange/CAS/min/max but not add.
**Overlap with [#14060](14060-metal-float-atomic-load-exchange-cas.md):** its R1 review (10-30) already listed this
exact bug as an unfiled follow-up; #14153 is the reporter's filing of it. #14060's local branch
(`fix/issue-14060` @ fd5ab6116, fixer `5f63gx`) adds the address-space-aware `getUnsupportedFloatAtomicReason`
(textures keep E55204). I sent the triager these receipts (msg 23) and asked it to choose (a) stack on #14060's helper or
(b) a separate fix. I route the work after its report. #14060's draft PR opens 11-02 22:05Z; #14153's R6 ends 11-06.

10:13Z (triager msg 24, its finding): the generic `InterlockedAdd(floatTex[c], 1.0, o)` and
`InterlockedAdd(RWBuffer<float>[i], …)` emit the same invalid texture `atomic_fetch_add`, so a fix that only
touches the meta capability would be partial. My `/workspace/inbox/...` paths are not mounted in the triager's container.

**[Triage] 10:18Z (triager msg 26/28; triager's findings).** bug / medium / P2 / Metal emit + core module, not a dup.
Regressed in **#8117** (b7df3c7aa, Aug 2025, fix for #8116). It added `metal` + `case metal:` to texture `InterlockedAddF32`
(hlsl.meta.slang ~28765-28795) and removed the float gate from Metal AtomicAdd/Sub (slang-emit-metal.cpp ~600-609).
Generic `InterlockedAdd` on a float texture, `RWBuffer<float>` or `RWTexture2D<half>` gives the same invalid output. Emulation was
rejected (it would need a texture2d<uint> binding, a maintainer call). Memo: [raw/triage-14153.md](raw/triage-14153.md). Held comment:
[raw/comment-14153-held.md](raw/comment-14153-held.md). Held labels: `reproduced` + `regression` + Type=Bug. I did not veto.
Side findings: float And/Or/Xor on a device float buffer is invalid MSL (the triager is told to file it per policy, without naming
#14153), and stale doc text at hlsl.meta.slang ~12780 (folded into the fixer's scope).

**Routing 10:19Z (mine): option B, stacked on #14060.** I dispatched slang-fixer on the canonical thread (msg 31 + memo file).
Fixer session `sess-1793614762821-zcmuu7`. Local `fix/issue-14153` comes off the tip of `fix/issue-14060`, and the fixer may not
touch #14060's branch. Steps: revert #8117's meta hunk, then call `getUnsupportedFloatAtomicReason` from AtomicAdd/Sub for texture,
texture_buffer and half dests. Groupshared add/sub stays as it is (MSL allows it). The fixer must report before any fallback to
a separate fix (C). Acceptance R1–R6 is in the memo.

10:21Z (fixer msg 40): claimed; worktree `wt-slang-14153`, local `fix/issue-14153` stacked on `fix/issue-14060` @ fd5ab6116.

10:21Z (triager msg 42, its finding): the float And/Or/Xor side finding reproduces on 6815ed82d and is cross-target (HLSL/GLSL/CUDA/SPIR-V; spirv-val E99999). Root cause: the hlsl.meta.slang op table constrains And/Or/Xor on `IArithmeticAtomicable`, not `IBitAtomicable`. `Atomic<float>.and` is already rejected. The triager is deduping, then filing it separately.

10:23Z (triager msg 44): side finding filed as [#14162](14162-float-bitwise-interlocked-ops.md). I verified it is R6-clean. It is filed-only.

**11:34Z [Report] (fixer msg 52; the fixer's figures).** Fixed locally: `fix/issue-14153` head **`87df5e5c4`**, stacked on
`fix/issue-14060` @ fd5ab6116 (untouched); worktree `/workspace/agent/wt-slang-14153`. 4 commits:
`7fce3ea07` (tests) → `164f5c41e` (meta revert) → `6996fbf71` (AtomicAdd/Sub call #14060's helper; the helper now passes
groupshared add/sub) → `87df5e5c4` (doc ~12780).
- R1: the repro now gives **E36107** (capability), exit 255.
- R2: E55204 for generic add/sub on float/half texture, `RWBuffer<float>` and half.
- R3 partial: the Metal runtime lanes did not run on Linux.
- R4: groupshared add/sub is unchanged, with a new test.
- R5 and R6 are met: 271 non-Metal outputs are byte-identical.
- Targeted tests 2538/2538. Full suite 11304/11307; the 3 failures are the known fp8-cuda ones.
- New behavior: `MetalObjectData` float add/sub now gets E55204.
- Conflicts: #14044 has the same hunks #14060 already has, and #14153 adds none. `fix/issue-14058` (ede51c684) merges cleanly.
- slang-reviewer is reviewing in patch mode (fixer msg 7).
**My replies (msg 53 → fixer, msg 55 → triager).**
- The fixer files, under the policy: the SPIR-V ICE `Atomic<float>.sub(const)` "Unhandled global inst in spirv-emit: neg"; the
  float/half Store-on-Metal gap if it is spec-invalid; groupshared float add with no MSL 4.1 version check. It does not
  re-file And/Or/Xor (#14162). MetalObjectData goes in the PR description, not a new issue.
- At release, the fixer rebases onto #14060's pushed head if it changed, and the PR description states the #14060 dependency.
- I told the triager to rewrite the "Planned fix" sentence of its held comment: InterlockedAddF32 → E36107 and generic add/sub → E55204.
  [raw/comment-14153-held.md](raw/comment-14153-held.md) was updated to the triager's new text (msg 54, 11:35Z).
- A `[GATE AUDIT]` warning fired on msg 53 because I quoted the string "[Fix Report]". It is a false positive: I sent no fix report.

11:50Z (fixer msg 56): side findings filed as [#14173](14173-spirv-atomic-float-sub-neg-ice.md) (SPIR-V ICE), [#14174](14174-metal-atomic-store-half-groupshared-float.md) (Metal half/groupshared-float store) and [#14175](14175-metal-groupshared-float-add-msl41.md) (groupshared float add needs MSL 4.1). I verified all three are R6-clean. All are filed-only. MetalObjectData goes in the PR description.

**12:16Z: reporter PR #14170.** albertrodriguezclo opened **#14170** "Metal: diagnose floating-point atomics on textures"
("Fixes #14153", 10:49Z, non-draft, head 24c894f11, reviewer jhelferty-nv). A sibling supervisor tick (321) told the fixer at 12:16Z.
**12:19Z fixer comparison (msg 62; the fixer's findings; matrix `/workspace/agent/r6-14153/cmp14170/matrix.txt` in the fixer's group):**
- Both branches give E55204 on float texture add, `RWBuffer<float>` add, half texture add and float texture exchange.
- On the method `InterlockedAddF32`, #14170 gives E55204 at emit (it keeps `case metal:`), and ours gives E36107.
- Only ours covers half device add/sub, has the meta revert, and integrates with #14060.
- Only #14170 covers float texture And/Or/Xor. It also double-reports texture float `InterlockedMax`.
- Conflicts: 1 emit hunk (#14060's lambda rename) and a semantic conflict in the float-atomics.slang test (E36107 vs E55204).
**12:22Z DECISION (mine): (a) defer to #14170.** Precedent: the bot does not compete with a reporter's own fix (#14053).
- The local branch is never pushed.
- I updated `r6-release-14153-5235` to post and release nothing while #14170 is open or merged, and to ask the operator only if it closes unmerged.
- Fixer (msg 85): stop slang-reviewer, fold the half device add/sub residual into the bot's #14174, no comment on #14170, then a closing 5-bullet.
- Triager (msg 87): held comment and labels cancelled. It stood down (msg 88, terminal).
- #14060 owner fixer `ytzi3p` (msg 89, pinned, landed as seq 44): state the conflict with #14170 in the 22:05Z draft PR, and rebase if #14170 merges first.
- Dashboard msg 95: deferral report, plus an optional question on whether the bot should note the InterlockedMax double-report on #14170 (default: no post).

12:23Z (slang-reviewer msg 90): its patch review was stopped at the fixer's request. It had finished first: APPROVE_WITH_NITS, 0 bugs, now moot. It lists 2 side finds that #14170 does not cover: Metal `atomic_half` add/sub (going into #14174) and vector float atomics emitting `atomic_packed_*` (new, unfiled; the fixer may route it).

**12:28Z fixer closing 5-bullet (msg 92).** Deferred. The branch stays local, the post-hold steps are void, and `wt-slang-14153` is left for the GC.
#14174 is edited and retitled to "Metal: `half` atomics and `groupshared` `float` store emit atomics that MSL does not have". It now adds half add/sub and InterlockedAdd on half buffer and groupshared targets. I checked it live: no #14153 or #14170 reference, no @-mentions.
The reviewer's verdict was discarded. The vector side find (`__atomic_reduce_add` on float2/half2 emits `atomic_packed_*`; `isFloatingType` is scalar-only; public InterlockedAdd rejects vectors) reproduces on master. I told the fixer to file it under the policy (msg 97, low priority).

12:40Z (fixer msg 94): the vector side find is filed as [#14182](14182-metal-vector-atomic-packed.md). It covers any vector destination, uint2 included. I verified it is R6-clean. **The fixer's side of the chain is CLOSED.**

**11-06 10:09Z R6-release run (`r6-release-14153-5235`): no action.** Live: #14153 OPEN, no comments, no labels;
assigned to maintainer **jkwak-work** (self-assigned 11-02 17:57Z, replacing the auto-assigned jhelferty-nv; milestoned and
issue type set at the same time). #14170 OPEN, non-draft, not merged, head `7cee79c0a` (pushed after 24c894f11; the author
replied to CodeRabbit 11-04 23:02Z), review requested from jhelferty-nv with no human review yet, CI 6 success / 1 failure /
1 pending. By rule (2) nothing was posted and no one was released. The bot branch stays local. A closed-unmerged #14170 would
also need jkwak-work's say, because the maintainer owns the issue.

**Open / resume on:** the operator's optional #14170-note answer (dashboard msg 95); #14170 review/merge by jhelferty-nv; `r6-release-14153-5235` ran 11-06 10:09Z (no action). Resume only on a #14170 close/merge webhook; a closed-unmerged #14170 goes to the operator and needs jkwak-work, who owns #14153. Triager, fixer and reviewer are all closed.
