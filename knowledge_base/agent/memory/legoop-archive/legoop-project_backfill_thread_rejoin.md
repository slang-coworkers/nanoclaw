---
type: project
title: "issue_comment backfill must use gh-issue-<repo>-<num> thread or it orphans; the rejoin fix is"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# issue_comment backfill must use gh-issue-<repo>-<num> thread or it orphans; the rejoin fix is

Manually backfilling/replaying a GitHub issue_comment into the orchestrator must land it on the issue's canonical thread `gh-issue-<repo>-<num>` (matching `deliverGitHubIssueOpened`), NOT a bare `String(issueNumber)`. The pre-#536 `deliverGitHubMention` fall-through used the bare number + no mintPerThread → comment orphaned into a generic session with no chain history (row marked `completed`, orchestrator never acted). Root-caused + fixed in **PR #536** (`src/webhook-github.ts`: `isIssue` gate → `gh-issue-` thread + `mintPerThread`). Same path #521's `ROUTE_ISSUES_TO` forwarding feeds, so before #536 every auto-forwarded comment orphaned.

When replaying comments through a webhook receiver (peer-forward: `X-Webhook-Trust: pre-validated` + HMAC-SHA256 of raw body with `INTERNAL_REGISTER_SECRET`, POST to `:GITHUB_WEBHOOK_PORT/webhook/github`): only replay comments on **open** issues (check `gh api .../issues/N --jq .state`), never `nv-slang-bot[bot]`'s own comments (feedback loop), and the idempotency guard is **per-session** (`gh-<commentId>`) so a comment can exist in two sessions — orphan rows must be deleted manually. Cleanup: backup the session inbound.db, `DELETE FROM messages_in WHERE id IN (...) AND thread_id NOT LIKE 'gh-issue-%'`.

Gotchas: (1) `scripts/q.ts` agent-id list in `$(...)` substitution can emit a stray `1000` token amid UNDICI warnings — hardcode the IDs for `ncl groups restart --rebuild` loops. (2) On `/update-*` fan-merge, an untracked locally-authored skill dir (e.g. `slang-clarity-review-runner` before #537 merged) collides with its now-tracked upstream copy and aborts the merge — `rm -rf` the untracked dir (after confirming it's on origin) then re-merge. Related: [[project_prod_lego_routing_split]], [[project_issue_comment_mention_gate]].

