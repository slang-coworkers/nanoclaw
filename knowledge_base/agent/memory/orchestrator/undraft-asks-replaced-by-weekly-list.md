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

**New dated entries (list sends, carry-over adds, RESOLVED removals) go to [[undraft-asks-weekly-list-history.md]], never here.** This file holds only the rules, the current pending-state table and the method; full dated detail lives in the history sibling and the linked chain records.

## Current state (2026-11-26)

- **Last list sent 11-23** (3rd list, dashboard send id 31, 25 rows) - awaiting operator bulk answer or maintainer flips; live-verify every row (draft flag, head, CI) before listing or acting again. Rows + dispositions: history sibling.
- **Rolled again to the next list:** #13027 #13038 #13970 slangpy#1158 rhi#869.
- **Never-listed, ready-flip pending (roll to the next Monday list; live-verify first):**
  - slang-rhi#990 (fixes slang-rhi#989, CUDA dispatch host overhead; chain closed bot-side 11-27, final head `5259ff2`, CI green all platforms, MERGEABLE; P2 - no per-PR ask) - [rhi-989-cuda-dispatch-host-overhead.md](../slang/rhi-989-cuda-dispatch-host-overhead.md)
- **Parked, carried (NOT un-draft rows):** #14549 (A5 docs-regen gate stands + E39034 collision with draft #14497), #14362 (maintainer Q1 unanswered since 11-05), #13972/#13991 (parked on silent maintainers since 11-04), #14276 (awaiting skiminki-nv under #14458; final one-shot recheck 12-09).
- **CI caveat for the next list:** #14606/#14637/#14643/#14667 at-head CI runs were `waiting` since 11-18-20 (SM80 pool starvation) - confirm green at listing time.

- **Method that worked:** match open bot drafts (`gh pr list --author app/nv-slang-bot`) to supervisor-state dispositions and
  `slang/*.md` lines naming the PR. Live-check them with one aliased GraphQL batch (isDraft, reviews, closing-issue labels), then get
  behind counts from `compare/<base>...<head>`. The keyword hold flags are noisy ("held draft" ≠ held), so judge each one by hand.
