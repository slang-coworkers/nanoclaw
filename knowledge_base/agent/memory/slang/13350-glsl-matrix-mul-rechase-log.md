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
