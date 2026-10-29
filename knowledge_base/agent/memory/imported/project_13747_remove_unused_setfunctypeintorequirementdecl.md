---
type: project
name: project_13747_remove_unused_setfunctypeintorequirementdecl
description: "slang#13747 (jhelferty-nv filed 10-19; reassigned to saipraveenb25 10-21, labels Autodiff/Office-Sai): delete dead SemanticsDeclHeaderVisitor::setFuncTypeIntoRequirementDecl (no callers since #9808) + its only-user helper addModifiersForParamPassingMode once #13406 lands. #13406 merged 10-22, so it is unblocked. 10-28 16:37Z the assignee saipraveenb25 asked @nv-slang-bot to open the PR, → draft PR #13976 (R1 APPROVE), PARKED on saipraveenb25 review + cloneModifiers answer; one-shot rechase-13747-review-b9fe 2026-11-04 16:00Z."
metadata:
  node_type: memory
  type: project
---
**2026-10-19 15:4xZ, `issue_opened`.** Live read: OPEN, 0 comments, human author jhelferty-nv,
self-assigned (timeline: two `assigned` events, no cross-references), no labels, live body = payload.
Only session on `gh-issue-shader-slang/slang-13747` is this Main webhook session.

**Claims checked locally:**
- master: `setFuncTypeIntoRequirementDecl` appears only as the declaration (`slang-check-decl.cpp:796`)
  and the definition (`:15417`). No callers. `addModifiersForParamPassingMode` does not exist on master.
- #13406 head `956342d873` (her commit, 10-15): the helper is defined at `:7632` and its **only** call is
  inside `setFuncTypeIntoRequirementDecl` (`:15517`). The bot's 10-02 note that synthesis also used the
  helper no longer holds at her head; so the issue's "only it uses" is right.

**Disposition: held. Nothing dispatched or posted.** Same pattern as
[[project_13498_breaking_change_label_policy]]: maintainer self-filed + self-assigned, nobody asked the bot.
It is also a sequenced follow-up to #13406, which she took over (10-14) and on which she posted
"@nv-slang-bot stand down" (10-16, issuecomment-6224584448) — see
`memory/slang/11709-13406-ref-split-review-rounds.md`. A bot PR here would race her own cleanup.

**Resume** only on a comment that @-mentions @nv-slang-bot (arrives as a webhook; no timer needed).

**10-21:** jhelferty-nv unassigned herself; the assignee is now **saipraveenb25** (author of the #9808
autodiff refactor). Labels `Autodiff`, `Office-Sai`; milestoned by jkwak-work 10-19.
**10-22:** #13406 merged as `0bd71cd709` (PR head was `4060f30928`). On master `3218a76125` (10-28) the helper is at
`slang-check-decl.cpp:7613`, and its only call is inside the dead function (`:15512`). The function is
declared at `:796` and defined at `:15496`, with no callers. The issue is fully unblocked.

**10-28 15:38Z, `pr_mention` ([6473409904](https://github.com/shader-slang/slang/issues/13747#issuecomment-6473409904)).**
saipraveenb25: *"Yes, this looks like it can be removed 👍"*. The live body matches the payload (not edited). It
does not mention @nv-slang-bot and asks nothing of the bot. It is the assignee confirming. **Held again:
nothing dispatched or posted.** The resume trigger is unchanged: a comment that @-mentions @nv-slang-bot.

**10-28 16:37Z, `pr_mention` ([6474830683](https://github.com/shader-slang/slang/issues/13747#issuecomment-6474830683)).**
saipraveenb25 (assignee): *"@nv-slang-bot: can you open a PR for this cleanup?"*. The live body matches the payload. This is the
resume trigger. **Routed to `slang-triager`** on `gh-issue-shader-slang/slang-13747` with `<github-post-authorized />`,
following the procedure (issue → triager). The triager owns the handoff to the fixer, and I did not message the fixer
directly (see the invisible-authorization desync lesson). Verified facts went under an Orchestrator note.

**10-28 16:42Z, triage.** slang-triager: refactoring / low / frontend / P3, not a duplicate. It posted issuecomment-6474944140 and
handed off to slang-fixer (fixer msg 7, same thread). I verified both claims: no callers on master, and `cloneModifiers`
(`:795`/`:15492`) has no callers either. The triager asked the assignee on the issue whether to also delete
`cloneModifiers` (Approach B). Approach A (exactly what the issue names) is the default. Triage memo:
`/workspace/inbox/a2a-1793205773652-k76w6p/triage-13747.md`. Next is the fixer's PR (it should call `report_pr_created`).

**10-28 17:13Z, PR open.** slang-fixer opened **draft PR #13976** (`fix/issue-13747`, head `0ab8fab0ec`). Verified live: 0 additions, 58 deletions,
one file, `pr: non-breaking`, `Fixes #13747`. pr-mappings → slang-fixer `sess-1793205739169-grtb8h` on the canonical thread. Checks: 2 pass,
53 skipped. The fixer reports a Debug build and 1165/1165 tests on CPU/VK/CUDA (its claim, not re-run by me). Next is the fixer's review
round → [Fix Report] → the triager's [Triage Resolution]. The `cloneModifiers` (Approach B) question is still open with the assignee.

**10-28 17:42Z, R1 review.** slang-reviewer (A + Devin + clarity + lead check) gave APPROVE on `0ab8fab0e`: 0 bugs, 0 gaps, 0 questions. Its
own run: Release build clean and full suite 11004/11007, with the 3 failures pre-existing on master (its claim). It went to the fixer and
nothing was posted to GitHub. Combined review: `/workspace/inbox/a2a-1793209336917-jui3ij/combined-review-13976-r1.md`.

**10-28 17:45Z, [Triage Resolution]: fixed, draft held for maintainer review.** Explanation comment issuecomment-6475618103. The issue
comment 6474944140 was updated in place (checked 17:45:50Z). Release full suite 11004/11007, with 3 fp8 CUDA coopmat tests that also fail on master. CI
dispatch 40732468787 was yielded to human-priority work (retry-yielded-bot-ci reruns it). The falcor gate needs a human. The reviewer has a
`cloneModifiers` patch ready if saipraveenb25 says yes. **Parked on saipraveenb25** (review + mark ready + cloneModifiers answer).
Timer: one-shot **`rechase-13747-review-b9fe`**, 2026-11-04 16:00Z (read back from `ncl tasks list`). Webhooks on #13976 go to the fixer
session `grtb8h`.
