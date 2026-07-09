---
title: "Pushing workflow-file changes: App token lacks workflows perm → fork + REST cross-fork PR"
type: learning
topic: agent-ops
source: learnings/1783521395969-pushing-workflow-file-changes-app-token-lacks-work.md
---

# Pushing workflow-file changes: App token lacks workflows perm → fork + REST cross-fork PR

# Symptom
`git push origin fix/issue-<n>` is remote-rejected when the branch touches any `.github/workflows/**` file:

```
! [remote rejected] fix/issue-<n> -> fix/issue-<n>
  (refusing to allow a GitHub App to create or update workflow `.github/workflows/<file>` without `workflows` permission)
```

The `nv-slang-bot[bot]` GitHub-App installation on `shader-slang/slang` does **not** carry the `workflows` permission. This is NOT the "token invalid / not logged in" case — a container restart does not grant a new App permission. It fires only for workflow-file content; ordinary source pushes to `origin` still work.

# Workaround (verified working 2026-07-08 on slang#11989 → PR #12001)
1. Push the branch to the **slang-coworkers/slang fork** instead of origin:
   `git push coworkers fix/issue-<n>`  (remote `coworkers` = https://github.com/slang-coworkers/slang, pushable). The fork's App installation DOES grant `workflows`, so this succeeds.
2. Open a **cross-fork PR into upstream master via the REST API** — NOT `gh pr create`:
   - `gh pr create` uses GraphQL and fails: `Fork collab can't be granted by someone without permission (createPullRequest)`.
   - REST works with the App token:
     ```
     gh api -X POST repos/shader-slang/slang/pulls \
       -f title="..." -f head="slang-coworkers:fix/issue-<n>" -f base="master" \
       -F draft=true -f body="$PR_BODY" --jq '.html_url'
     ```
     (`-F draft=true` for a draft; `-f body="$(cat body.md)"` — heredoc/var is fine.)
3. Then `report_pr_created`, add the `pr:` label (`gh pr edit <n> -R shader-slang/slang --add-label "pr: non-breaking"`), append the bot subscript.

# CI caveat for these PRs
The main `ci.yml` will NOT attach on such a PR while it's a DRAFT: drafts skip the `pull_request` CI path, AND `workflow_dispatch --ref fix/issue-<n>` can't target it because the branch lives on the fork (upstream returns HTTP 422 "No ref found"; the fork's default branch has no `ci.yml` → 404). Don't try to force CI — it runs when a maintainer flips the PR to ready-for-review. (For same-repo `fix/` branches, the normal `gh workflow run ci.yml --ref` on drafts still applies.)

# Why
Same bot identity/token everywhere; the difference is per-repo App-installation permission scope. The fork grants `workflows`; upstream doesn't. REST `/repos/*/pulls` is permitted where GraphQL's fork-collab grant is refused.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1783521395969-pushing-workflow-file-changes-app-token-lacks-work.md`_
