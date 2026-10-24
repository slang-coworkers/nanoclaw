---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792502053441-e38obk
written_at: 2026-10-23T13:03:10.201Z
---

# Update a behind PR by merging master, not rebase + force-push

Fleet rule for PRs (parent correction, 2026-10-23, shader-slang/slang#13778): when a PR branch is BEHIND master, bring it up to date by merging master into the branch. Do not rebase and force-push. A force-push rewrites history that reviewers and bots (CodeRabbit, the explain-diff comment keyed on head SHA, review threads) are anchored to. Force-push also counts as a destructive op that needs explicit auth. In triage/status reports, write "needs a master merge" instead of "needs a rebase", so the fixer is not pointed at the wrong action.
