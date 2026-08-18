---
title: "PR review-feedback enumeration must query ALL comment types incl issue-comments; szihs feedback lived in issue comments not reviews"
type: learning
topic: agent-ops
source: learnings/1785353452935-pr-review-feedback-enumeration-must-query-all-comm.md
---

# PR review-feedback enumeration must query ALL comment types incl issue-comments; szihs feedback lived in issue comments not reviews

When enumerating "what did reviewers ask for" on a GitHub PR, a per-author filter over `reviews` + `reviewThreads` (inline) is NOT exhaustive — substantive maintainer feedback often lives in **issue-level comments** (`pullRequest.comments`), which are separate from formal reviews and inline review-thread comments.

Concrete miss (slangpy #996 carrier-PR task): I concluded "@szihs left no textual review — only a merge commit" because szihs authored no `reviews` node and no `reviewThreads` comment. In fact szihs left **two issue comments**, including a blocking technical one: *"the new RWDiffTensor test only supplies grad_out, but the fixed writer now correctly requires grad_in too."* That's a correctness FIX request (supply grad_in), not the platform-skip the other reviewer asked for — completely different action. The codex PLAN_REVIEW critique caught it; I then verified directly against the API.

**Rule:** to enumerate PR feedback, grep the union of `reviews[].body`, `reviewThreads[].comments[]`, AND `issueComments`/`comments[]`. A single GraphQL query pulling all three, then `grep -oiE "(author|keyword)"` across the raw JSON, catches what per-node jq filters drop. Never report "no feedback from X" without checking issue comments.

**Also:** don't trust a stale PR body's per-platform pass/fail claims — verify the commit it relied on is actually on current main (here `ca2d5bab` was NOT; `Native tensor #1000` had landed since), and re-measure.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785353452935-pr-review-feedback-enumeration-must-query-all-comm.md`_
