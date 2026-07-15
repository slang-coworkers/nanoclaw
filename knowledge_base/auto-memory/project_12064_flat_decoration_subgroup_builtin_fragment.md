---
name: project_12064_flat_decoration_subgroup_builtin_fragment
description: "#12064 restore Flat deco for SubgroupLocalInvocationId in fragment — MAINTAINER APPROVED (jkwak, confirmed accidental-revert diagnosis); chain terminal-positive; maintainer owns merge"
metadata: 
  node_type: memory
  type: project
  originSessionId: 364b3e64-f41a-4aa0-9447-c51942703c0e
---

shader-slang/slang PR **#12064** (author **LDeakin**, external fork) — "restore Fix #10909: Add Flat decoration for SubgroupLocalInvocationId in fragment shaders".

**Approver verdict (head `da4d3e025a57`, mode=live):** ABSTAIN_POLICY / OPEN_GAP. Ledger-only, nothing posted to GitHub. Clauses 6/6 pass; primary `github-actions[bot]` review 🟡 APPROVE_WITH_NITS (0 bugs / 2 gaps). Gap#1 (else-branch reachability) cleared; Gap#2 (composite `uint4`-mask + non-fragment negative case untested) held → OPEN_GAP.

**jkwak-work asked two review questions** (comments r3583348007 inline + issuecomment-4975087362) → routed to slang-fixer MODE=pr-review-fix. Fixer answered both in ONE consolidated top-level reply: https://github.com/shader-slang/slang/pull/12064#issuecomment-4975541190

**Corrected history (overturns approver's "merge-queue reverted #10916" claim — verify at claim-precision, don't relay revert-mechanism claims as fact):** #10909 → fixed by #10916 (`1c660f0d0b`, 2026-04-23 19:38Z) → **effectively dropped 20 min later by #10913** (`c1d5bb3778`, 19:58Z). #10913's parent IS #10916's squash commit, yet its tree reverted `needFlatDecorationForBuiltinVar()` to pre-#10916 shape AND deleted #10916's test — a **squash-from-stale-base clobber** (cache-key PR touched same function), NOT a revert PR. Master lacks handling → bug back. #12064 restores verbatim, coexists safely with #10913's `BuiltinSpvVarKey` cache-key fix.

**Condition (Q1):** `emitInst`→`emitBuiltinVar`→`getBuiltinGlobalVar`→`needFlatDecorationForBuiltinVar`; `emitBuiltinVar` sole emitter of `kIROp_SPIRVAsmOperandBuiltinVar`, always `BuiltinInput`, value type (non-ptr) → the new `else` branch. Reachability confirmed from source.

**Gap-test:** `tests/spirv/wave-lane-mask-fragment-flat.slang` — composite `uint4` mask (`WaveGetLaneEqMask`→`builtin(SubgroupEqMask:uint4)`) fragment→Flat present, compute→no Flat. Empirically verified vs local PR-head build (3 negative controls fire). Delivered as ready-to-add fenced block in the reply — **author owns the external fork, not pushed**.

**State: TERMINAL-POSITIVE (07-15).** jkwak-work **APPROVED** (pullrequestreview-4699846994) and independently confirmed the accidental-revert diagnosis: "the previous PR was reverted by a mistake; @kaizhangNV FYI." (kaizhangNV had reviewed the clobbering #10913, itself bot-authored.) Both questions answered; gap-test provided. No reply/push needed (approval ack, no new question; new commit on external fork risks dismissing the approval). **Maintainer owns merge.** A `synchronize` webhook was routed to slang-pr-approver for a fresh head-current decision. **Correction (was speculation, now falsified by receipts):** the synchronize was a pure **master-merge, NOT the suggested test being added** — PR diff byte-identical to rev1 (same `slang-emit-spirv.cpp` hunk + same 16-line test; the composite-mask test was never added). Approver Rev 2 verdict **ABSTAIN_POLICY / OPEN_GAP @ `95f1ebf2d272`** (mode=live_late), all 6 clauses pass, Devin completed 0 bugs/0 flags/3 informational, Gap#1 cleared via reachability proof, **Gap#2 (non-fragment negative test) still HELD** (not closed at this head). Recorded `human_verdict=APPROVED` at the exact decision head → **withhold-on-SAFE agreement** (maintainer accepts low-severity coverage gap as follow-up; #12037/#12041 pattern), **not a false-safe** — correctness corroborated by head-current review + Devin + fixer local build. Ledger-only, nothing posted. Learning: a pure master-merge synchronize doesn't close a held gap — re-decide from the PR's own diff, don't assume. Per re-open rules a substantive new maintainer/author comment re-opens → re-dispatch slang-fixer on thread `gh-issue-shader-slang/slang-12064`. See [[feedback_verify_regression_claims_at_precision]] and [[feedback_never_relay_a_verdict_not_in_hand]].
