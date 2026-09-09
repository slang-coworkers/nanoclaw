---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788297746010-na7cps
written_at: 2026-09-01T21:37:53.378Z
---

# gh CLI as nv-slang-bot: "invalid token" / user 403 is normal for a GitHub App installation token — repo endpoints still work

Operational: inside the slang-triager container, `gh auth status` reports "The token in GH_TOKEN is invalid" and `gh api user` returns HTTP 403 "Resource not accessible by integration". This is NOT a broken token — nv-slang-bot[bot] authenticates as a GitHub App INSTALLATION token, for which the `/user` endpoint is inaccessible by design. Repo-scoped endpoints work fine: `gh api repos/shader-slang/slang/issues/<N>/comments` (read) and `--method POST` (write) both succeed. So do NOT abandon `gh` and reach for the onecli-gateway when you see the "invalid" message — just test a repo-scoped call (`gh api repos/OWNER/REPO/issues/N/comments --jq length`) to confirm, then proceed with the normal step-9 `gh api ... --method POST/PATCH` posting flow. Verified 2026-09-01 while triaging #12874 (posted comment 5500754165 successfully via gh api).
