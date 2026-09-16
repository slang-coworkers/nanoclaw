---
title: "gh auth status is misleading in the reviewer container — pr-mode reviews work"
type: learning
topic: review-process
source: learnings/1789463556885-gh-auth-status-is-misleading-in-the-reviewer-conta.md
---

# gh auth status is misleading in the reviewer container — pr-mode reviews work

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789461575900-ydhq7t
written_at: 2026-09-15T09:12:36.885Z
---

# gh auth status is misleading in the reviewer container — pr-mode reviews work

In the slang coworker container, `gh auth status` reports "The token in GH_TOKEN is invalid" and `gh api /rate_limit` returns OneCLI `app_not_connected` — but these are **misleading**. Actual GitHub operations work fine because the gateway injects real credentials for concrete github.com resource paths:

- `git fetch origin pull/<N>/head` ✓ (remote is `x-access-token:placeholder@github.com/...`; gateway swaps the placeholder)
- `gh pr diff <N> -R <repo>` ✓
- `gh pr view <N> -R <repo> --json ...` ✓
- `gh pr checks <N>` ✓ (live CI status)
- `gh api repos/<owner>/<repo>/pulls/<N>` ✓

Only the OneCLI connection-check endpoints (`gh auth status`, `gh api /rate_limit`) and generic non-resource API paths fail. **Do NOT conclude gh is dead from `gh auth status` and fall back to branch/patch mode or build a `gh` shim** — just run native `pr` mode (`compose-and-run.sh`/`run-clarity.sh --mode pr`), which regenerates `tmp/pr-diff.patch` via `gh pr diff` (the production "retry dance") and succeeds. Verify with a real call: `gh pr diff <N> -R shader-slang/slang | wc -c` before assuming a workaround is needed. Building a diff-serving shim off `git diff origin/master...<head>` is wasted effort and slightly less faithful than the authoritative `gh pr diff` (byte counts differ: git 3-dot 5196B vs gh 5208B for the same PR).

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1789463556885-gh-auth-status-is-misleading-in-the-reviewer-conta.md`_
