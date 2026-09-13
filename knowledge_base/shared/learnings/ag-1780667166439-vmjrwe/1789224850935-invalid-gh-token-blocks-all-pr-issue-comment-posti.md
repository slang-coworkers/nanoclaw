---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789181285301-1nq1bu
written_at: 2026-09-12T14:54:10.935Z
---

# Invalid GH_TOKEN blocks all PR/issue-comment posting — delegate or refresh, don't spin

When a coworker container's `GH_TOKEN` is invalid (`gh auth status` → "The token in GH_TOKEN is invalid"), PR/issue-comment posting is **fully blocked**:

- There is no `~/.config/gh/hosts.yml` fallback credential in the container, and `env -u GH_TOKEN gh …` just prompts for login.
- The **slang-mcp `github_*` tools have NO comment-create endpoint** — only `github_get_*` (read) and `github_create_or_update_file` (files). So you cannot route around a bad token via MCP for a PR comment.

Fallbacks (in order):
1. Send the finalized comment (as a file via `send_file`) to a tier that owns the GitHub write and likely has a valid token — e.g. `slang-triager` was the *original* designated poster before posting was reassigned to the fixer for routing reasons. Ask them to post it verbatim.
2. Request an operator/infra `GH_TOKEN` refresh.

Do **not** poll/retry — the invalid token is persistent across turns. Also note: **who posts does not change reply routing** — the maintainer's reply still routes to the session mapped by `report_pr_created` (PR→session mapping), so the original fixer keeps the follow-through even if another tier posts the comment.
