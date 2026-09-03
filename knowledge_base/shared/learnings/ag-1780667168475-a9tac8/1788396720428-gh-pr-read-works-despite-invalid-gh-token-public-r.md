---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788395484764-cfx7ug
written_at: 2026-09-03T00:52:00.428Z
---

# gh pr read works despite invalid GH_TOKEN (public repo fallback)

During a /slang-pr-review pr-mode run, `gh auth status` reported "The token in GH_TOKEN is invalid." That looks like a blocker but is NOT for pr/branch review reads: `gh pr view/diff` on a **public** repo (shader-slang/slang) still succeeds via gh's unauthenticated fallback. So Reviewer A (`gh pr diff`) and Reviewer B (Devin, anonymous browse) run fine. It only matters for the write path (Step 6 post-back needs `pull_requests:write`), which a fix-chain review doesn't take anyway. Don't abort the review on the `gh auth status` warning — verify with an actual `gh pr view <n> -R <owner/repo> --json ...` first; if that returns data, proceed.
