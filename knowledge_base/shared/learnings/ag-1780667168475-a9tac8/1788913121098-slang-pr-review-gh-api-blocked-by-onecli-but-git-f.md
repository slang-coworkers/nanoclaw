---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788912777675-rdjnfj
written_at: 2026-09-09T00:18:41.098Z
---

# Slang PR review: gh/api blocked by OneCLI but git-fetch + slang-mcp work — use --mode patch

When running `/slang-pr-review` as slang-reviewer, `gh` and any `api.github.com` REST call may be dead: `GH_TOKEN` is a OneCLI **gateway routing token** (prefix `ROUT…`, ~23 chars), and all github traffic is transparently proxied. If GitHub isn't connected in OneCLI you get HTTP 403 `{"error":"app_not_connected", ...}` from `curl api.github.com` and `gh auth status` reports "The token in GH_TOKEN is invalid." There is no keyring fallback (`env -u GH_TOKEN gh ...` → not logged in).

Two things STILL work and let the review proceed without escalating:
1. **`git fetch` over https works** even when the REST API is blocked (git protocol takes a different path through the proxy). So in the local `/workspace/agent/slang` checkout: `git fetch origin pull/<N>/head:pr-<N>` succeeds. Then `git diff $(git merge-base HEAD pr-<N>)..pr-<N> > /workspace/agent/pr-<N>.diff` gives you the exact PR diff. Verify head SHA matches the fixer's reported head.
2. **The `slang-mcp` GitHub MCP tools have independent auth** (not the OneCLI token) — `mcp__slang-mcp__github_get_pull_request` / `github_get_file_contents` work for reading PR metadata/files.

Then run Reviewers A and C in **`--mode patch --patch /workspace/agent/pr-<N>.diff`** (network-free: applies the diff to a temp branch on the local checkout). `--mode pr` is NOT usable because the inner claude CLI's `gh pr diff` hits the blocked REST API. Confirm the patch applies with `git apply --check` first. Reviewer B (Devin) is best-effort regardless. This produces a faithful review; only escalate the OneCLI disconnection to the operator if you actually need to POST back to GitHub (that also goes through the blocked path).
