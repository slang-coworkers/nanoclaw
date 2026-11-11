---
type: policy
description: Stop per-PR "un-draft?" asks to the operator; maintainers flip bot drafts themselves; one weekly list instead
---

# Un-draft asks: weekly list, not per PR (2026-11-03)

**Evidence:** on 11-03, slang had **206 open bot drafts**, 94 of them updated since 10-20. The operator has answered essentially
none of the per-PR "may #N leave draft?" asks (#13726 got 10, #13413 got 16, #13331 got 16, and #13982, #14023 and #13966 got 3 each). Meanwhile
**21 bot PRs merged since 10-20**, every one marked ready by a maintainer/shepherd (jkwak-work: #13988, #14090, #14079;
pdeayton-nv: #14111, #13850; and others).

**Rule:**
- The bot still never runs `gh pr ready` without a go-ahead.
- **Don't send per-PR un-draft asks to the dashboard.** When a draft is review-complete, record it as "ready-flip pending" in its
  chain record or in supervisor-state, and let the maintainer or shepherd flip it, as they already do.
- The operator gets **one weekly list** of review-complete bot drafts, and can answer in bulk ("un-draft all", or a list).
- The exception is a P0/P1 or a regression fix that needs a fast flip: one ask, then the cap in
  [reask-cap-park-after-final-ask.md](reask-cap-park-after-final-ask.md).

## Weekly runs (task `weekly-undraft-list-4573`, Mon 09:00Z)

- **2026-11-09 (1st list):** sent to orchestrator-dashboard (send id 5). Rows: slang #13130 #13241 #13939 #13970 #14203
  #14267 #14255 #14293 #14317 #14314 #14313 (regression/P1), then oldest #12334 #12697 #12722 #12759 #12780 #12806
  #12813 #12932 #12967 #12980 #13027 #13038, slangpy#1158, rhi#869. "un-draft all" = these 25 only. Excluded on purpose:
  #13966 (superseded by merged #14352), #14081 (unanswered tangent-vector CR), #14300 (waits #14293), #14023 (landing
  order), #12382/#12408 (hazard). Unverified review, so left off: #12429, #12713. About 55 newer review-complete drafts
  roll to the next list. **Carry-over checked for the 11-16 list:** slang#14221 (fixes #14053; R3 APPROVE_WITH_NITS applied; MERGEABLE, behind; no human review); slang#14446 (fixes #14443, P2 LLVM first-codegen race; reviewer APPROVE_WITH_NITS applied, head `5952662ce`; owner: fixer on gh-issue-shader-slang/slang-14443). Next run: do a bounded dashboard read after 11-09 09:00Z for "un-draft all"/PR numbers, then route each PR
  to its owning fixer session (merge master by plain merge → `gh pr ready` → report). Never flip it yourself.
- **Method that worked:** match open bot drafts (`gh pr list --author app/nv-slang-bot`) to supervisor-state dispositions and
  `slang/*.md` lines naming the PR. Live-check them with one aliased GraphQL batch (isDraft, reviews, closing-issue labels), then get
  behind counts from `compare/<base>...<head>`. The keyword hold flags are noisy ("held draft" ≠ held), so judge each one by hand.
