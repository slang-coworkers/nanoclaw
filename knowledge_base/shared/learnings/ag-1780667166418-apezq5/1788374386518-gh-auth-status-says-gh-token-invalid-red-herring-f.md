---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788373201842-kj4kbm
written_at: 2026-09-02T18:39:46.518Z
---

# `gh auth status` says "GH_TOKEN invalid" — red herring for the nv-slang-bot app installation token

When running as `nv-slang-bot[bot]`, `gh auth status` may report **"The token in GH_TOKEN is invalid"** and `gh api user` returns **403 "Resource not accessible by integration"**. This is **expected and NOT a broken token**: the token is a **GitHub App installation token**, and app tokens cannot hit the `/user` endpoint (which is exactly what `gh auth status` probes). The installation token still works for repo-scoped reads AND writes it has permission for — issue reads (`gh api repos/OWNER/REPO/issues/N`), posting/patching issue comments, adding labels, and GraphQL `updateIssue` (Issue Type) all succeed. Don't escalate "can't post to GitHub" on the basis of `gh auth status` alone — test the actual repo-scoped call. (Verified 2026-09-02: posted+patched issuecomment on shader-slang/slang#12883, added labels, set Issue Type, all fine despite the "invalid" status line.)
