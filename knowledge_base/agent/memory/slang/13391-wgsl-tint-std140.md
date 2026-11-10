---
type: chain
title: slang#13391 / #8323 — WGSL-via-Tint std140 layout (draft PR #13402)
description: PARKED 2026-11-09, no timer (re-ask cap). Draft PR #13402 is done on our side. Its last signal (real Tint on the Windows x64 CI rows) has never run, because the bot-dispatch throttle deadlocked it and the run was deleted 10-08. Un-drafting (B) gets around the throttle. 11 operator asks went unanswered. Webhook-only now; dated log in the sibling rechase-log.
---

# slang#13391 + #8323 → draft PR #13402

> **PARKED 2026-11-09, no timer** (parked-chain register: `supervisor-state.json` → `gh-issue-shader-slang/slang-13391.disposition`). No re-chase is scheduled. **Resume on:** an operator "B" / "un-draft 13402" / "unpark 13402"; a human comment or review on #13402, #13391 or #8323; a new head or CI run on #13402; a #13478 PR landing or #13451 merging; #13935 merging (then #13402 needs a master merge first). For B: slang-fixer merges master (merge, not rebase), then runs `gh pr ready 13402`; watch `tests/wgsl/wgsl-spirv-uniform-std140.slang.1/.2` and `tests/metal/stage-in-2.slang` on the Windows x64 test job.

- **PR:** https://github.com/shader-slang/slang/pull/13402, branch `fix/issue-13391`, head `fa23079922` (pushed 10-02 19:37Z). It is a draft, assigned to and review-requested from kaizhangNV.
- **Owner:** slang-fixer session `sess-1790934848504-cxpbfi`, thread `gh-issue-shader-slang/slang-13391`.
- **Our gates:** peer review round 2 was APPROVE_WITH_NITS (10-02).
- **Remaining signal:** real Tint on the Windows x64 rows: `tests/wgsl/wgsl-spirv-uniform-std140.slang.1/.2` and `tests/metal/stage-in-2.slang`.
- **As of 11-09:** MERGEABLE, 215 behind master, 0 runs on the head SHA; 205 runs `waiting` repo-wide.

Dated history (the deadlocked run, the 12 re-chases, the A/B/C asks): [[slang/13391-wgsl-tint-std140-rechase-log.md]]. New dated entries go there, not here.

## Why it is stuck

- **The only CI run is gone.** Run 37055310934 (workflow_dispatch) on the head was throttled: `wait-for-human-priority` yielded and
  `falcor-build-approval-gate` waited on `falcor-ci`. The rerunner was blocked by the ~94 other waiting bot runs. By 10-08 the run returned
  404, along with every Actions run created 10-01T20:05Z..10-03T10:07Z (a bulk deletion; cause unknown). So option A (cancel + rerun) is dead.
- **Un-drafting (B) gets around the throttle.** `ci.yml` throttles only when `IS_THROTTLED_BOT` is true (line 101:
  `event_name == 'workflow_dispatch' && triggering_actor == 'nv-slang-bot[bot]'`). A ready PR runs on `pull_request` and is not throttled.
  Proof: #13450 was un-drafted 10-07, and its run 37724999088 passed 47/47 with Windows x64 tests. The line was unchanged through 11-09.
- **Upstream fixes, neither landing:** #13451 (jkiviluoto-nv, approval-only waits; open and BEHIND, idle since 10-09) and
  #13478 (Falcor split into its own workflow; maintainer-filed and self-assigned, so it gets no bot work; advisory triage cmt 6059786647; no PR).

## Overlapping work

- External PR #13935 (for [#13904](13904-wgsl-scalar-cb-layout-reflection.md)) makes the same one-line change in
  `getTypeLayoutRuleNameForBuffer` (`!isWGPUTarget(targetReq)`). Whichever lands second needs a trivial rebase; if #13935 merges first,
  slang-fixer merges master into #13402.
- [#13704](13704-wgsl-forced-scalar-entry-point-uniforms.md) is the entry-point-uniform sibling. Once #13402 lands, `wgsl-spirv*` hits it
  too, so its fix must use `isWGPUTarget`. No textual conflict.

## Lessons

- In a task run with no attached chat, `ask_user_question(timeout:0)` aborts at the 1800 s MCP idle limit, so it is not a durable ask.
  Post the choice on orchestrator-dashboard instead.
- `gh run list --status waiting --limit 300` got a 401 on page 2. `gh api 'repos/…/actions/runs?status=waiting&per_page=100' --jq .total_count`
  returns the count in one page.
- Before writing a background note into a chain file, read its **newest** dated entry, not just the entry I insert after. On 10-08 I
  called a deleted run `waiting` because I skipped this.
- Operator replies in the dashboard session are `direction=in kind=chat` rows mixed in with agent reports. Find them by content.
- An aged run escalates only on a rerun: [aged-run lesson](../imported/feedback_an_aged_run_does_not_escalate_a_rerun_does.md).
