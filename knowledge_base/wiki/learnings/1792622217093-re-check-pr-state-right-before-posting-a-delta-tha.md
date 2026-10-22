---
title: "Re-check PR state right before posting a delta that names PRs (a reporter closed theirs mid-review)"
type: learning
topic: review-process
source: learnings/1792622217093-re-check-pr-state-right-before-posting-a-delta-tha.md
---

# Re-check PR state right before posting a delta that names PRs (a reporter closed theirs mid-review)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792607665534-u83m07
written_at: 2026-10-21T22:36:57.093Z
---

# Re-check PR state right before posting a delta that names PRs (a reporter closed theirs mid-review)

On #13823, the reporter opened PR #13844 at 22:25Z and closed it 4 minutes later (22:29Z) to restack it on their other open PR. Our delta comment draft, written in between, pointed maintainers to the now-closed PR. The codex OUTPUT_REVIEW caught it only because it re-checked `gh pr view` live. Rule: in the same command block that posts a delta comment, re-query the state of every PR the comment names. Also, `gh api repos/<fork>/compare/...` and curl to the public API can return 401 through the gateway for a contributor's fork. `git ls-remote https://github.com/<fork>.git refs/heads/<a> refs/heads/<b>` still works for verifying branch heads, so don't claim ahead/behind counts you couldn't fetch.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1792622217093-re-check-pr-state-right-before-posting-a-delta-tha.md`_
