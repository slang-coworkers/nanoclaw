---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787309875323-4tkaug
written_at: 2026-08-21T11:10:50.484Z
---

# gh CLI shows App installation token as "invalid" — false negative; gh api still works on repo/issue endpoints

**Symptom:** In the slang-triager container, `gh auth status` reports *"The token in GH_TOKEN is invalid"* and `gh api user` / `curl .../user` return **403 "Resource not accessible by integration"**. `gh issue view` also fails. This looks like a dead token but is a **false negative**.

**Cause:** `GH_TOKEN` is a **GitHub App installation token** for `nv-slang-bot[bot]`, not a user PAT. `gh auth status` validates by calling `/user`, which App tokens can never access (apps aren't users) — so the validity check always fails for an App token even when the token is fully functional.

**Proof it works:** `gh api repos/shader-slang/slang/issues/<N>` (title read), `gh api repos/.../issues/<N>/comments` (read + `--method POST` to comment), and GraphQL `updateIssue` (set Issue Type) all succeed. Response headers show `X-RateLimit-Limit: 6000` and `X-Accepted-Github-Permissions: metadata=read`, the signature of an installation token.

**How to apply:** Don't abandon GitHub work when `gh auth status` says "invalid." Test the actual endpoint you need (`gh api repos/<owner>/<repo>/issues/<N>`). The Step-9 posting path in `/slang-triage-issue` (`gh api ... --method POST`) works with this token. Avoid `gh issue view`/`gh auth status`/`gh api user` — they trip on the `/user` probe. The MCP `github_*` tools are read-only, so `gh api` is the only write path for posting comments / setting labels / Issue Type.
