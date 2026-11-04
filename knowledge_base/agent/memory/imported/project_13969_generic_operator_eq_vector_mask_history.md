---
type: project
name: project_13969_generic_operator_eq_vector_mask_history
description: "Dated history of the slang#13969 / PR #13970 generic vector operator== chain and its follow-up #13971 (closed as dup), 10-28 11:33Z → 11-03 15:12Z. Split from project_13969_generic_operator_eq_vector_mask on 2026-11-03; new dated entries append here."
---

# slang#13969 / PR #13970: dated history (UTC)

Current state, decisions and lessons: [[project_13969_generic_operator_eq_vector_mask]].
"Verified" means Main checked it live. Reviewer/triager memos are under `/workspace/inbox/a2a-<id>/`.

## 2026-10-28

- **11:33Z `issue_opened`** (jtytgat, external); Main webhook session `sess-1793187212186-dbwe49`. Open, 0 comments, no labels.
  Reported on slang-playground and 2026.17-25-gc7954ebd1 (VulkanSDK 1.4.363.0). **11:35Z** dispatched to slang-triager on
  `gh-issue-shader-slang/slang-13969`.
- **11:39Z triager interim:** reproduced at codegen on TOT a30c9d491 — the generic body emits `(vector<bool,3>)all(a == b)`.
- **11:58Z [Triage]** (memo `a2a-1793188697085-wxo5r8/triage-13969.md`): bug, regression, silent wrong code, high, frontend, P1;
  cause, bisect and Approach A/B/C as in the record. Verified 11:59Z: triage cmt 6468368732, labels `regression` + `reproduced`,
  type Bug. slang-fixer claimed at 11:58Z (worktree wt-slang-13969 @ a30c9d491).
- **13:04Z draft PR #13970** @ c7c481a14 ("Compare generic-element vectors per component in the builtin operator fast path",
  `pr: breaking change`); pr-mapping → fixer `bmd8so`; reviewer session `zcr2zy` on the canonical thread. **13:05Z fixer addendum:**
  label rationale (E30019), the explicit-call residual left for Approach B, and the deleted gh-12458 decline test (cases moved).
- **13:37Z R1 APPROVE_WITH_NITS** (`a2a-1793194641696-ukc3nj/combined-review-13970-r1.md`, diff_hash dcd4f190…): 0 bugs. Nits:
  tests that tell old `all` from per-component results, a full breaking-change Risk line, a contract comment at the fast path
  (slang-check-impl.h:4495 still said "for performance"); the residual is not blocking if a follow-up issue tracks it.
  **13:38Z close-out:** no new full-suite failures on the L40S; unit test 61/0; Risk line must also name E30055 and the bypassed
  user `operator==`. Nothing posted (no post marker).
- **14:17Z [Fix Report]** @ c3385da13 (all nits, no R2). Verified 14:2xZ: draft, review requested from jhelferty-nv, explanation
  comment updated 14:09Z, CI 53 SKIPPED / 4 SUCCESS (draft gate). PARKED; operator told on the dashboard. The fixer thought a
  follow-up issue needed operator approval (retired framing); Main sent the triager to dedup the residual against #12720/#6966.
  Timer `recheck-13970-maintainer-94f5` set for 10-31 14:00Z.
- **14:21–14:22Z follow-up #13971 filed** (nv-slang-bot; Bug, `reproduced`, no `regression` — no known-good baseline). Not a dup of
  #12720/#6966/#13008; lists 3 directions. Its own Main webhook session `msjew9` hit ownership rung 0: dispatched nothing.
  The fixer got the cite instruction (seq 22); the timer was updated to cover #13971.
- **17:06–17:41Z maintainers on dedup** (no bot mention, so holds): jkwak-work assigned #13971 to tangent-vector (17:06Z), called it
  a known limitation (cmt 6475498478, 17:07Z), then a dup of #13969 (cmt 6475827437, 17:22Z); #13969 was assigned to tangent-vector.
  tangent-vector on #13969 (17:41Z): "This seems to be a duplicate of #13971. We should collapse these into a single issue that
  covers the reproducers from both." Opposite survivors. Main forwarded all three verbatim to the triager: ask, don't close.
- **17:45Z triager** asked on #13969 which issue survives (cmt 6476336314), offered to fold the reproducers, and warned that
  `Fixes` would close the survivor while the explicit-call path is broken. **17:48Z** jhelferty-nv closed #13971 "as a duplicate of
  #13969" (cmt 6476406084); `msjew9` relayed it. jhelferty-nv also added milestone "Q4 2026 (Fall)" to #13969 (17:49Z).
- **17:52–17:53Z triager [Report] (verified):** cmt 6476336314 edited in place to add #13971's test as "Reproducer 2"; the scope
  question stays open. The fixer got the Risk-line repoint (seq 24). Triager one-shot `t-e33a5c` set for 10-30 15:00Z.

## 2026-10-30 – 10-31

- **10-30 15:0xZ triager `t-e33a5c` (verified):** no change; the Risk-line repoint is done ("Explicit `operator==`/`!=` calls
  (Reproducer 2 on #13969) remain open"), body no longer names #13971. Last one-shot `t-acf921` set for 11-03 15:00Z.
- **10-31 14:0xZ Main `recheck-13970-maintainer-94f5` (verified):** no human activity since 10-28 17:52Z; CI 53 SKIPPED / 6 SUCCESS.
  One line to orchestrator-dashboard (msg 5); no dispatch, no timer.

## 2026-11-03

- **15:0xZ triager `t-acf921` (verified):** no change. Sibling Main task session `vbq9iw` (system:tasks:t-acf921) chose the
  no-gate default: no second @-ping, scope → `Part of #13969`. Dispatched slang-fixer at 15:04Z (pinned `bmd8so`, seq 26) to edit
  the body and post one no-ping comment; asked the operator once to un-draft (dashboard msg 19, the P1 exception, releasing the
  10-28 "hold un-draft" suggestion). No timer; supervisor-state → ready-flip pending.
- **15:11–15:12Z fixer done (verified):** body has `**Scope:** Part of #13969`, no `Fixes`; Tests line shortened to keep the body
  under 1,000 characters (disclosed); cmt 6607460026 on #13969 (5-bullet, no @-mentions). Still a draft at c3385da13. The report
  landed on `msjew9`, not `vbq9iw`, so `msjew9` confirmed on the dashboard.
