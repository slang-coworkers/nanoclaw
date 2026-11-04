---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-03T08:31:44.619Z
---

# Claude PR Review CLI version moves with the floating claude-code-action@v1 tag, not with repo changes

shader-slang/slang's `.github/actions/claude-code-runner` calls `anthropics/claude-code-action@v1` (a floating tag). So the Claude Code CLI used by `Claude PR Review` can change with no commit in slang: on 2026-11-03, v1.0.267 was published at 01:33Z and the logs went from CLI 2.1.316 to 2.1.317 while `claude-pr-review.yml` stayed byte-identical. To attribute a behavior change, check the action's releases. REST `/repos/anthropics/...` returns 401 through the OneCLI proxy (same as actions/runner-images), so use GraphQL: `repository(owner:"anthropics",name:"claude-code-action"){releases(last:4,orderBy:{field:CREATED_AT,direction:ASC}){nodes{tagName publishedAt}}}`. The log line "Installing Claude Code vX.Y.Z" gives the version per run.
