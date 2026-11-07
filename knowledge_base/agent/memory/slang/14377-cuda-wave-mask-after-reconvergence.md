---
type: chain
title: slang#14377 — CUDA wave ops get the per-side mask after an if/else reconverges
description: Human-filed 11-06 04:40Z (albertrodriguezclo, also the #14016 reporter). Codegen reproduces; the wrong runtime mask does NOT reproduce on the L40S. FOLDED into the #14016 chain's draft PR #14050 (test 2c1ce8856). The reporter found (08:12Z) that the wrong sums came from the #13479 firstbithigh bug, not this mask, so #14050 is back to "Fixes #14377" (verified 08:16Z). TERMINAL for triage; check the closure when #14050 is retargeted and merged. The triager owns the reporter's open question.
tags: [cuda, wave-intrinsics, active-mask, wrong-code, human-filed]
---

# slang#14377 — CUDA wave-op mask after if/else reconvergence

**Filed** 11-06 04:40Z by albertrodriguezclo (CONTRIBUTOR). No labels, no assignee, 0 comments
(live check 11-06). Claim: after an `if`/`else` that every lane leaves, `synthesizeActiveMask` passes the
per-arm exit ballot (`__ballot_sync(entryMask, true)` inside each arm) to the next wave op, instead of the
pre-branch mask. The reporter sees wrong SpMV sums on an RTX 4060 Ti; WGSL/Metal are correct. Their
workaround is a full mask through `__intrinsic_asm`. Repro (32 lanes, `if (tid.x < 20)`, then
`WaveActiveBallot`) is in the issue.

**Relation to [#14016](../imported/project_14016_cuda_active_mask_ballot_sync_overhead.md).** Same pass, same
reporter. That chain (triager `sess-1793277757506-ktr6eo`, fixer `sess-1793279937673-7qx06k`) holds draft
**#14025 @ 63597277a** (exit ballots on every edge + dead-ballot pruning) and stacked draft **#14050 @
a9da82b23** (`fix/issue-14016-merge-mask`: reuse the entry mask at merges of regions with only normal
exits). Both drafts were unchanged and unreviewed on 11-06, assignee kaizhangNV. #14016 itself is assigned to
jkwak-work (11-02); #14377 is unassigned. #14050's entry-mask reuse is the "expected" behavior the reporter
asks for, so it may already fix #14377. The reporter calls #14377 "a different problem" (correctness, not cost).

**Open question for triage.** On sm_70+, PTX `vote.sync` waits for all non-exited lanes in membermask to execute
a `vote.sync` with the same mask. It does not say "the same instruction", so the two arm ballots *might* return
the full mask. That makes the reporter's "20-lane / 12-lane" reading a claim to check on the GPU, not a given.

**11-06 dispatch (Orchestrator, Main session `sess-1793940034548-gbgo1f`).** Grep found no owner chain (the
only `14377` hit was a hash substring), no assignee, no sibling Main session on the thread. Sent slang-triager on
`gh-issue-shader-slang/slang-14377`: reproduce on the L40S at master, #14025 and #14050 heads; if #14050 fixes it,
recommend a fold into the #14016 chain (test + "Fixes #14377"), not a new fixer.

**11-06 05:04Z triager [Report] (session `sess-1793940183330-hnb4gx`).** Comment 6677382075 checked live (Type set to Bug, no
`reproduced` label, no @-mentions, no links). Master emits the reported per-arm ballots (`:1796`), but on the L40S both arms get
0xFFFFFFFF on master, on #14025 and on #14050, including a 4M-lane stress run. In the SASS, both arms call one shared WARPSYNC+VOTE routine.
The PTX rule allows this; the CUDA C++ guide's "same program point" rule does not promise it. At #14050, the repro emits
`WaveActiveBallot_0(w_0 != 0U, _S5)`, which matches "Expected". The reporter was asked for driver/NVRTC versions, the failing kernel and
whether it has abnormal exits. Memo: `/workspace/inbox/a2a-1793941446095-hfs5w3/triage-14377.md`.

**11-06 05:05Z decision (Orchestrator): rec A — fold, no new fixer.** Pinned send to the #14016 triager `ktr6eo` (verified at inbound
seq 50, thread gh-issue-shader-slang/slang-14016, in_reply_to=2). Its fixer `7qx06k` adds `tests/cuda/active-mask-if-merge-entry-mask.slang`
(FileCheck `CUDA-NOT: __ballot_sync(` + vk/cuda) on `fix/issue-14016-merge-mask`, adds "Fixes #14377" to #14050, and sends a
[Fix Report]. The PR stays a draft. Abnormal-exit regions are out of scope (memo only, not filed). #14377 triager told (in_reply_to 16).
**Switch rule:** if the reporter's failing kernel has break/continue/return or the cause is a driver difference, #14050 says "Addresses", not "Fixes".

**11-06 05:20Z reporter correction (comment 6677616686).** The small repro gives the right values on an RTX 4060 Ti too, so only the
codegen is wrong. The quoted wrong sums come from a larger SpMV kernel (several branches inside a loop), and the reporter has not confirmed
that the cause is this mask. **Decision: #14050 says "Addresses #14377", not "Fixes"**, so a merge doesn't auto-close the issue. Sent to
ktr6eo before the description edit (#14050 head = test commit 2c1ce8856; my relay misnamed the head as 018e21f79, which is an earlier commit), and the comment was relayed verbatim to hnb4gx (owner; it
decides whether to reply on GitHub). Switch to "Fixes" only if the reporter confirms this mask is the only cause.

**05:24Z.** The triager replied on GitHub (cmt 6677667094, verified, no @-mentions). The reply thanks the reporter for the correction, points to draft #14050 and the test, explains the abnormal-exit caveat, and offers to run the larger kernel. The #14050 body now says "Addresses #14016" + "Addresses #14377" (verified, 05:24:27Z, head 2c1ce8856). The fixer's [Fix Report] via ktr6eo is still pending. hnb4gx is waiting for the reporter's larger kernel.

**08:12Z reporter root cause (cmt 6680363767, verified).** The wrong sums came from 2026.16.1's CUDA `U32_firstbithigh`, which inverted
inputs with bit 31 set; PR #13479 fixed it (merged 10-09, verified). The results follow firstbithigh alone, and the mask never gave a wrong value
on an RTX 4060 Ti (5 shapes, -O1/-O3; driver 621.01, NVRTC 12.8). The reporter keeps the issue for the codegen, won't open a second PR, and
wants #14050 to land with the repro as its test. **Decision: back to "Fixes #14377"** (the "Addresses" reason, unexplained values, is gone).
Sent to ktr6eo for the fixer (body-only change, stays a draft), and relayed verbatim to hnb4gx, which may post a short GitHub reply and then sends
the closing 5-bullet.

**08:16Z — TERMINAL for triage (hnb4gx closing [Report], verified).** Reply cmt 6680415474 (no @-mentions); issue labels `reproduced`,
Type Bug; open, unassigned. #14050 body now "Addresses #14016" + **"Fixes #14377"** (verified 08:16:06Z, head 2c1ce8856, still a draft, base
`fix/issue-14016`). GitHub acts on the closing keyword only once #14050 targets master, so the bot's reply promised a closure check.

**Resume on:** #14025 merge, which makes the fixer retarget #14050 to master: check that "Fixes #14377" still links (`closingIssuesReferences`).
Then #14050's merge: check that #14377 actually closed, and close it by hand with a comment if it did not. Also resume on a human comment on #14377.

11-06 08:16Z triager msg 128 (Main-verified): #14050 body now "Addresses #14016" + **"Fixes #14377"**, head still 2c1ce8856, draft; #14025 still 63597277a. The switch back follows the reporter's 08:12Z comment 6680363767: the wrong sums were the old `U32_firstbithigh` CUDA-prelude bug (fixed by #13479), not the mask. Bot reply 6680415474 (08:15Z). `closingIssuesReferences` stays empty until #14050 is retargeted to master after #14025 merges; the squash (PR_BODY) then closes #14377. **Check after the retarget that #14377 shows as a closing reference.**

11-06 22:54Z triager msg 130 (Main-verified): the reporter backs the design on both PRs (comments 6697788048 on #14025, 6697788672 on #14050, 22:51Z). They want #14025 merged first, then #14050, and offered to re-time the radix sort and rerun the 3 new tests on an RTX 4060 Ti after #14025 merges. The fixer accepted on both PRs (6697808889 / 6697809230, 22:53Z), because the L40S cannot show the per-arm mask at runtime. No change to either PR: #14025 63597277a, #14050 2c1ce8856, drafts, 0 reviews. Still ready-flip pending (weekly list); waiting on kaizhangNV.
