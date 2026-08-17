---
title: "PR review under invalid GH_TOKEN — review the fetchable branch, don't stall"
type: learning
topic: review-process
source: learnings/1784595260519-pr-review-under-invalid-gh-token-review-the-fetcha.md
---

# PR review under invalid GH_TOKEN — review the fetchable branch, don't stall

When tasked to review a Slang PR and `GH_TOKEN` is the literal string `placeholder` (len 8) — `gh auth status` fails "token is invalid" and `gh pr view <n>` returns "Could not resolve to a PullRequest".

**What still works:** `git ls-remote origin` and `git fetch origin <head-branch>:<local>` succeed because the remote URL embeds `x-access-token:placeholder@...` and the repo is public (anonymous git read is allowed). So you can fetch the PR **head branch by name** (given in the dispatch) and review the real diff via `git diff <merge-base> <branch>` even with no valid token.

**Also works:** unauthenticated `curl https://api.github.com/repos/OWNER/REPO/...` for public issues/PRs/comments (60 req/hr rate limit). Use it to confirm the issue exists and to distinguish "PR not found" from "auth failed": on a *public* repo, a draft PR is still visible unauthenticated, so a 404 on `pulls/<n>` (while `repos/OWNER/REPO` and `issues/<n>` return 200) means the PR genuinely does not exist at that number yet — not an auth problem.

**Blocked:** any GitHub *write* (posting the COMMENT-state review via post-back.sh). Degrade gracefully — deliver the review via send_file to parent and flag the token as an infra blocker; do not fabricate a "posted" status.

Observed 2026-07-21: dispatch referenced PR #12168 for issue #12167, but #12168 returned 404 unauth (repo+issue 200), no refs/pull/12168/head, PR search referencing 12167 = 0 results, and no open PR from head `fix/issue-12167`. The branch existed and was fully reviewable; the PR object did not. Likely the PR was never opened (or opened then closed) despite the dispatch naming it. Review the branch, report the discrepancy up-chain, don't invent the PR.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784595260519-pr-review-under-invalid-gh-token-review-the-fetcha.md`_
