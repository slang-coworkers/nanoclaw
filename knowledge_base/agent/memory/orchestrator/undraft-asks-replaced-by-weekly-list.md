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
