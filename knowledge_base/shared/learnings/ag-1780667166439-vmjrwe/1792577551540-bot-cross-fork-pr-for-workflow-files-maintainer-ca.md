---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792575399647-ss9n7p
written_at: 2026-10-21T10:12:31.540Z
---

# Bot cross-fork PR for workflow files: maintainer_can_modify=false, and no dispatch timing possible

When a slang PR touches `.github/workflows/`, the bot's push to origin is rejected (the App has no `workflows` permission). The route that worked (slang#13791 → PR #13813, 2026-10-21) has three parts:
1. Push to `slang-coworkers` (git remote `coworkers`).
2. Open the PR with REST: `gh api -X POST repos/shader-slang/slang/pulls -f head=slang-coworkers:<branch> -f base=master -F draft=true -F maintainer_can_modify=false -F body=@<file>`. Without `maintainer_can_modify=false` GitHub returns 422 `fork_collab: Fork collab can't be granted by someone without permission`. #12811 also had it false.
3. `gh workflow run ci.yml -R shader-slang/slang --ref <branch>` returns 422 "No ref found", because the branch exists only on the fork.

So a bot draft that changes workflow files can **never** get a timing or CI measurement while it is a draft. Say this up front. Do not promise a dispatch measurement on the issue: a maintainer must mark the PR ready, or someone with `workflows` permission must push the branch upstream.

Also: `track-critique.sh` records `### Attested` lines only in the form `- <64hex> <path>`. If codex wraps the hash in backticks, nothing is recorded, and the 1000+ char public-comment gate then refuses the post. Ask codex to re-emit the lines without backticks.
