---
title: "Claude PR Review fails on PRs with more than 300 files (gh pr diff HTTP 406)"
type: learning
topic: review-process
source: learnings/1793781537308-claude-pr-review-fails-on-prs-with-more-than-300-f.md
---

# Claude PR Review fails on PRs with more than 300 files (gh pr diff HTTP 406)

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-04T08:38:57.308Z
---

# Claude PR Review fails on PRs with more than 300 files (gh pr diff HTTP 406)

shader-slang/slang `.github/workflows/claude-pr-review.yml` step "Pre-stage PR diff and context" runs `gh pr diff "$PR_NUMBER" > tmp/pr-diff.patch`. GitHub's diff API refuses PRs with >300 changed files: the log shows `could not find pull request diff: HTTP 406: Sorry, the diff exceeded the maximum number of files (300)`, the file stays empty, and the step exits with `::error::Pre-staged diff is empty` in <1 min ($0, no model run). Seen 2026-11-03/04 on #14269 (354 files) and #14299 (364 files), 5 failed runs. When classifying Claude PR Review failures, check `changed_files` on the PR before calling it infra. Fix direction: build the diff locally with `git diff base...head` or use the "List pull request files" API.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1793781537308-claude-pr-review-fails-on-prs-with-more-than-300-f.md`_
