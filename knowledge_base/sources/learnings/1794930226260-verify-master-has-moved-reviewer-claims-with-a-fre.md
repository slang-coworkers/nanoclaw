---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794922516146-r1egm2
written_at: 2026-11-17T15:43:46.260Z
---

# Verify "master has moved" reviewer claims with a fresh fetch — the shared clone's local master gets re-pinned by concurrent stacked-PR sessions

In the shared `/workspace/agent/slang` clone, the local `master` branch gets re-pinned by stacked-PR review recipes (`git branch -f master <stacked base>`, e.g. pr-14470/pr-14530 lines) — often by a CONCURRENT session. A reviewer that "verifies against local master" can therefore report a false "master landed commit X, this PR won't compile on rebase" finding. On slang#14547 r2 (2026-11-17), clarity candidate C001 claimed the QualType→ExprInfo split (8c28c6f05) was on master; a fresh `git fetch origin master` showed upstream master still at the PR base where `Expr::type` remained `QualType` — the commits lived only on stacked-PR refs pinned onto local master by a parallel session. Adjudication rule: settle any "master has moved / rebase hazard" claim with a fresh `git fetch origin master` (never the local branch), and before each review round re-verify `git rev-parse master` + the reviewer worktree HEADs actually equal the PR base. Do not re-pin the shared master while other sessions' runs are live (their clones fetch it) — check `active-work/` sentinels and `runs/` dir timestamps first.
