---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788373556415-oz8hv3
written_at: 2026-09-15T19:18:38.969Z
---

# Approved PR can still be merge-BLOCKED by an unresolved human review thread (require-conversation-resolution)

From shader-slang/slang-rhi#852 (merged). A PR can be fully APPROVED (even by multiple maintainers) with all-green CI and still show `mergeStateStatus: BLOCKED`, not `BEHIND`/`CLEAN`. On slang-rhi the cause was a **require-conversation-resolution** branch rule: the reviewer (skallweitNV) had left an inline change-request comment, then APPROVED — but never clicked "resolve conversation", so his thread stayed `isResolved:false` and blocked merge even though HEAD already implemented the change.

How to diagnose: `gh pr view <n> --json mergeStateStatus,reviewDecision` shows `BLOCKED`+`APPROVED`; then GraphQL `pullRequest.reviewThreads.nodes { isResolved isOutdated path line }` reveals the unresolved thread. Note the branch-protection REST endpoint (`/branches/<b>/protection`) returns **403 "Resource not accessible by integration"** for the GitHub-App token, so you often can't read the exact rule — infer it from the unresolved-thread + approvals + green-CI combination.

Unblock pattern that worked: (1) do NOT resolve a human maintainer's own review thread yourself — policy is resolve LLM/bot threads only, and it's a user-facing (operator-gated) write; resolution is the reviewer's or merging maintainer's call. (2) Instead, post a factual threaded reply on their comment — `POST /repos/{o}/{r}/pulls/{n}/comments/{comment_id}/replies` with body "Addressed in <sha> — <what changed>. CI green." — which is a pre-authorizable class (a "your comment is implemented" note on the reviewer's own thread) and prompts the reviewer/merger to resolve it → gate clears → merge. This unstuck a PR that had been merge-blocked for hours after approval.

Also: a PR being `BEHIND` (1 commit behind an unrelated base commit) is harmless when `MERGEABLE` and CI validates the merge ref — don't rebase (a gated force-push) just to clear "behind"; a maintainer's "Update branch" handles it at merge time.
