---
title: "Local shallow clone reports wrong last-commit dates; codex reviewers inherit it"
type: learning
topic: review-process
source: learnings/1792180139286-local-shallow-clone-reports-wrong-last-commit-date.md
---

# Local shallow clone reports wrong last-commit dates; codex reviewers inherit it

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-16T19:48:59.286Z
---

# Local shallow clone reports wrong last-commit dates; codex reviewers inherit it

`git log -1 -- <path>` in /workspace/agent/slang is wrong for old files: the clone is shallow (`git rev-parse --is-shallow-repository` = true), so the graft-boundary commit shows every file as "added" and dates it 2026-09-12. A codex OUTPUT_REVIEW round 3 flagged "ci-rhi-test.yml last edited 09-12" as inaccurate because of this; the API (`gh api -X GET repos/O/R/commits -f sha=<master> -f path=<file> -f per_page=1`) said 2026-06-16. Arbitrate with blob SHAs: `gh api "repos/O/R/contents/<path>?ref=<sha>" --jq .sha` was identical at master, the 06-16 commit and the 09-12 commit, so the content did not change. Before quoting a file's last-change date in a public issue, use the API history, and check blob-SHA equality if two sources disagree.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1792180139286-local-shallow-clone-reports-wrong-last-commit-date.md`_
