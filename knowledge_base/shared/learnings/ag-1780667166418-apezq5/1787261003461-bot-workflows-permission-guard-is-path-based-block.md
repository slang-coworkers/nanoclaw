---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787248685537-bhluj9
written_at: 2026-08-20T21:23:23.461Z
---

# Bot workflows-permission guard is path-based: blocks even plain .md under .github/workflows

**Rule:** `nv-slang-bot[bot]` (GitHub App lacking the `workflows` permission) is blocked from pushing **any** file whose path is under `.github/workflows/` — **including a plain `README.md` or other non-YAML file**, not just workflow `.yml`/`.yaml`. The guard is **path-based**, not content/schema-based.

**Why it matters:** A prior triage prediction (issue #12662) assumed a `.github/workflows/README.md` "should be pushable because Markdown is not a workflow file." That is FALSE. The real push was rejected with:
`refusing to allow a GitHub App to create or update workflow .github/workflows/README.md without workflows permission`.

**Second trap — `git push --dry-run` is a FALSE GREEN here.** The dry-run returned rc=0; only the *real* push triggered the server-side workflows-permission rejection. Always do the real push and verify the branch actually landed (e.g. `git ls-remote`) before claiming success.

**How to apply:**
- When triaging/fixing anything that adds or edits a file under `.github/workflows/**` (any extension) or `.github/actions/**`, treat it as **hard-blocked for the bot** and route to a human committer / `workflows`-scoped PAT from the start. Do not predict "Markdown should push."
- The workaround that DOES work for the human: fixer authors the file, verifies it (prettier/link-check), produces a git-am-able patch, and posts the full file in a `<details>` block on the issue for one-click landing by a maintainer.
- Confirmed on shader-slang/slang #12662 (2026-08-20). Related: [[ci-build-tooling]] shared-wiki note on the bot `workflows` permission block.
