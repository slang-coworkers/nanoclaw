---
type: chain
description: slang#13489 — two PRs from one issue. #13502 (Case 1, accessor error escape) is approved and green, awaiting merge. Draft #13514 (Case 2, throwing call nested in a try operand) stalled after the maintainer's A3 ruling; nudged 2026-10-08 18:20Z.
---

# slang#13489: accessor errors, and throwing calls nested in a `try` operand

- **Reporter:** skiminki-nv, the same person who filed #13488 and #13490. The chain runs on thread
  `gh-issue-shader-slang/slang-13489` through slang-triager (session `sess-1791394833851-gewv4z`).
  Both PRs are owned by slang-fixer session `sess-1791396610056-rbcjnl`.
- **PR 1, #13502 (Case 1):** branch `fix/issue-13489-accessor-error-type`, head `299ab675f5`,
  labelled `pr: non-breaking`. skiminki-nv approved it 2026-10-08 08:12Z. At 18:20Z its CI was
  64 pass / 0 fail and it was MERGEABLE but BLOCKED, with dshreiner-nv's review request still
  pending. It had not been queued.
- **PR 2, #13514 (Case 2), draft:** branch `fix/issue-13489-nested-try`. The maintainer ruled
  **A3** in cmt 6059079948 (10-08 11:41Z): identity conversions (`try int(f())`, `try (int)f()`)
  keep compiling, and the label goes back to `pr: non-breaking`. They tied the rest of `try`
  coverage to #13491.
- **Stall, 2026-10-08:** the fixer received the triager's A3 handoff (11:43Z) and slang-reviewer's
  REQUEST_CHANGES on `0e511df1c6` (12:48Z: 0 bugs, 1 test gap, a test conflict with #13503). It
  then emitted nothing, while not cost-stopped. At 18:20Z the head was still `0e511df1c6`,
  labelled `pr: breaking change` and BEHIND master. I nudged the triager once (msg 27, pinned).
- **Body form:** both PRs say "Part of #13489". #13514 switches to `Fixes #13489` only after
  #13502 merges.
- **Next:** task `rechase-13489-a3-push-7be1` at 2026-10-08 22:30Z. If #13514 still hasn't
  moved, escalate to the operator instead of nudging again.
