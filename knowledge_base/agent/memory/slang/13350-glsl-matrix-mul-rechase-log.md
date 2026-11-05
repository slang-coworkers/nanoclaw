---
type: log
description: Dated re-chase log for slang#13350 / PR #13356 / #13355 / #13359 (09-30 → 10-31). Append new re-chase entries here; current state lives in the chain record.
---

# slang#13350 chain — re-chase log

Chain record and current state: [[slang/13350-glsl-matrix-mul-wgsl-metal-gate.md]]. All entries checked live.

- **09-30 19:35–19:55:** fixer finding (69 gates; 62 beyond the 7). Triager filed #13355 at 19:46Z, left unrouted.
  Draft #13356 opened @ 87c6c5c619 (+76/−7). Re-chase `rechase-13350-13355-d86c` set for 10-02.
- **09-30 21:39 [Triage Resolution]:** #13356 @ 39e7f0415e (+101/−8), r2 APPROVE_WITH_NITS, every build/test job SKIPPED
  (falcor gate needs a human). 21:52: #13359 filed.
- **10-01 01:05:** jkwak-work on #13359 (5922625720) asked how LLVM handles prefixes → triager. 01:25: triager answered (5922837368):
  LLVM FileCheck accepts comma `--check-prefixes`; the conflict is slang-test's grammar; duplicate-key crash found. #13359 assigned jkwak-work.
- **10-02 r1:** nothing moved. Checks 5 pass / 56 skipped. Asked the operator A (#13356 CI gate) + B (#13355 go/no-go), dashboard msg 17. Re-armed r2.
- **10-05 r2:** run 36780286138 `waiting` on falcor-ci since 09-30 21:34Z; our token cannot approve. 2nd ask. Re-armed r3.
- **10-06 22:13 / 22:48:** jkwak-work design cmt 6026415243 on #13359 → triager reply 6026863543 (see the record).
- **10-08 r3:** jhelferty-nv milestoned #13350 (10-07) and assigned #13355 to jkwak-work (10-05) → B closed as HOLD. 3rd ask for A (msg 21). Re-armed r4.
- **10-12 r4:** 47 behind; no reply. 4th ask for A (id 13): no answer defaults to (c). Re-armed r5.
- **10-15 r5:** no reply → **A recorded as (c)**; one short note to the dashboard; cadence slowed to ~7 days. Re-armed r6.
- **10-22 r6:** no change; 120 behind. Predicted the falcor-ci wait expiry at ~10-30 21:34Z; re-armed r7 for 10-31 (9 days) to land after it.
- **10-30 21:38:** expiry happened (triager msg 46); run ended `failure` 21:34:36Z. Told slang-fixer via the triager to post one status
  comment, no rerun. 21:43: posted, cmt 6534088003.
- **10-31 r7:** handled correctly, nothing else moved; 178 behind; master still has 69 gates. Dashboard seqs 507152–509671: no reply,
  and no Main session had told the dashboard about the expiry, so I sent a 5-bullet (no ask). Re-armed `rechase-13350-13355-r8-6fd2` for 11-07.
- **11-03 21:29:** jkwak-work filed **#14257** (Metal only, self-assigned), a duplicate of #13350. Triager dispatched on `gh-issue-shader-slang/slang-14257` for one pointer comment; #13356 still parked, no push. Record: [14257](14257-glsl-matrix-mul-metal-dup-13350.md).
- **11-04 16:57Z (triager msg 58; checked live):** jkwak-work (MEMBER) took #13356 out of draft at 16:40Z, APPROVED it at 39e7f04 with no change requests, and enabled squash auto-merge at 16:48Z.
  The pull_request CI run 41869955735 was in progress. State BEHIND, which is fine (merge queue). The fixer edited status comment 6534088003, and the triager made the final edit to issue comment 5917443980.
  **This makes decision A moot.** The fixer asked jkwak whether to add `Part of #14257`. I updated r8, and told the dashboard A is closed (5-bullet, no ask).
- **11-04 ~18:3xZ:** `pr_ready_for_review` webhook for #13356 reached Main. Not forwarded: slang-pr-approver is paused=1. Queued in `data/approver-pause-queue.md` (skip if merged on unpause).
- **11-04 20:50Z: TERMINAL (triager msg 72; checked live).** jkwak-work merged #13356 at 20:48:10Z as `f0660607f1`, and #13350 closed COMPLETED at 20:48:12Z. The fixer cleaned up its worktree and sentinel. No issue post was needed.
  r8 (11-07) is cut down to #13355 and #13359 only. I sent the dashboard a closing 5-bullet.
