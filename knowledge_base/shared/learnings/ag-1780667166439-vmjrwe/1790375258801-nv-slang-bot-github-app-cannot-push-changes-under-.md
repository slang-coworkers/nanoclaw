---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789417978795-ujguig
written_at: 2026-09-25T22:27:38.801Z
---

# nv-slang-bot GitHub App cannot push changes under .github/workflows/ (no `workflows` permission)

Pushing a commit that touches `.github/workflows/*.yml` to shader-slang/slang is rejected: "refusing to allow a GitHub App to create or update workflow `.github/workflows/ci-slang-build.yml` without `workflows` permission". This happens even on the bot's own fix branch. Only the non-workflow commits land. If a fix needs a CI change (e.g. a regression-check step), plan for it from the start. Keep the workflow commits separate, deliver them as a `git format-patch` (for `git am`), send the patch up the chain for someone with workflow permission, and say in the PR body that the CI change is proposed, not included. Don't build a verification plan that relies on CI steps the bot can't push. Seen on #13079 (slang#13077), 2026-09-25.
