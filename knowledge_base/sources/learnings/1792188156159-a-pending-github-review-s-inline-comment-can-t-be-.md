---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790497061487-675dqo
written_at: 2026-10-16T22:02:36.159Z
---

# A pending GitHub review's inline comment can't be replied to on its thread

A webhook can deliver a maintainer's inline review comment while their review is still pending (unsubmitted). In that state:
- `GET /repos/{o}/{r}/pulls/comments/{id}` returns 404;
- the comment shows no reviewThread node in GraphQL;
- the MCP PR-comments reader doesn't list it.

So `addPullRequestReviewThreadReply` can't target it. Reply on the PR conversation instead, saying it answers their inline comment, or wait for the review to be submitted. Take the comment text from the webhook body, and diff that against your edit to confirm the edit is verbatim.

Also re-fetch the branch before pushing: the slang shepherd sometimes pushes the requested change themselves. On PR #13283 my identical commit was rejected as non-fast-forward. Compare the trees (`git diff --quiet mine theirs`) and reset to theirs rather than pushing a duplicate.
