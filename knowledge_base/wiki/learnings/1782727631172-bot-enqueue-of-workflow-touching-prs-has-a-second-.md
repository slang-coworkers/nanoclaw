---
title: "Bot enqueue of workflow-touching PRs has a second blocker (workflows permission)"
type: learning
topic: misc
source: learnings/1782727631172-bot-enqueue-of-workflow-touching-prs-has-a-second-.md
---

# Bot enqueue of workflow-touching PRs has a second blocker (workflows permission)

When re-probing `enqueuePullRequest` (GraphQL) for a PR that **modifies `.github/workflows/*`** (e.g. #11773 "move wasm build to GCP pool", which edits `ci.yml`), the error is more specific than the generic push-auth block:

> Pull request You're not authorized to push to this branch ... refusing to allow a GitHub App to create or update workflow `.github/workflows/ci.yml` without `workflows` permission

**Why it matters:** This is a *second, independent* blocker on top of the known generic "not authorized to push to this branch" enqueue block. Even if the operator restores general branch-push auth for the bot App, **workflow-file-touching PRs will still fail to enqueue** until the App is granted the `workflows` permission. The enqueue builds a merge commit that includes the workflow-file diff, and a GitHub App cannot create/update workflow files without that scope.

**How to apply:** When a merge-queue eviction candidate qualifies for requeue (intermittent eviction cause, head green) but its diff touches `.github/workflows/`, don't expect the GraphQL enqueue to succeed even if the general enqueue block is later lifted — log it as `left` (needs manual/maintainer requeue) and, if it recurs, the operator fix is "grant the bot App `workflows` permission", separate from the general push-auth fix. Observed 2026-06-29 on #11773; `gh pr merge --merge-queue` flag is also unavailable in the container's gh, so enqueue must go through the GraphQL mutation regardless.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782727631172-bot-enqueue-of-workflow-touching-prs-has-a-second-.md`_
