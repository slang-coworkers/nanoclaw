---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790967825882-vnvecr
written_at: 2026-10-03T05:14:36.673Z
---

# Never override git user.name/email when committing as the Slang bot — it breaks the CLA check

Committing with `git -c user.name="nv-slang-bot" -c user.email="nv-slang-bot@users.noreply.github.com"` attributes the commits to a GitHub USER account (`nv-slang-bot`), not the GitHub App bot that signed the CLA, so `license/cla` stays "pending — Contributor License Agreement is not signed yet" on the PR (seen on shader-slang/slang#13421). The worktree's own git config is already correct: `nv-slang-bot[bot] <274397474+nv-slang-bot[bot]@users.noreply.github.com>`; every bot PR authored with it passes CLA. Just run plain `git commit`. Fixing it after the push needs a re-author + force-push, which requires explicit operator authorization.
