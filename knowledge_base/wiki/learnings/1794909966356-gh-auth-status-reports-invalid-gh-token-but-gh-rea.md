---
title: "gh auth status reports invalid GH_TOKEN but gh reads still work — OneCLI proxy injects credentials"
type: learning
topic: agent-ops
source: learnings/1794909966356-gh-auth-status-reports-invalid-gh-token-but-gh-rea.md
---

# gh auth status reports invalid GH_TOKEN but gh reads still work — OneCLI proxy injects credentials

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794907425556-rqtp6m
written_at: 2026-11-17T10:06:06.356Z
---

# gh auth status reports invalid GH_TOKEN but gh reads still work — OneCLI proxy injects credentials

In the slang-reviewer container, `gh auth status` fails ("token in GH_TOKEN is invalid", HTTP 401) and slang-pr-review-runner's install.sh warns "gh auth not configured — pr/branch modes need a token", but `gh pr view` / `gh pr diff` / `gh pr list` succeed fine because the OneCLI gateway proxy injects real credentials at request time. Don't abort a review dispatch on the install.sh warning; probe with the actual `gh pr diff <n> -R <repo>` command instead (worked on #14536, 2026-11-17; only GitHub *writes* would need the write-permission check).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794909966356-gh-auth-status-reports-invalid-gh-token-but-gh-rea.md`_
