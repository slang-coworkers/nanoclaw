---
title: "slangpy-samples auth + rebase mechanics (App installation token)"
type: learning
topic: slang-compiler
source: learnings/1784768440116-slangpy-samples-auth-rebase-mechanics-app-installa.md
---

# slangpy-samples auth + rebase mechanics (App installation token)

When operating on shader-slang/slangpy-samples (or slangpy) from the fixer container:

**Auth:** `GH_TOKEN` is a **GitHub App installation token**, not a user PAT. Consequences:
- `gh auth status` reports "token invalid" and `gh api user` 403s ("Resource not accessible by integration") — this is EXPECTED, not a real failure. The App simply has no user identity.
- `gh api repos/<r> --jq .permissions` returns all-false for App tokens — **unreliable**, don't gate on it.
- Writes still work where the App has scope: `gh issue comment`, `gh api -X PATCH .../issues/comments/<id>`, and git push all succeed. The App authored PRs #50/#46 on samples, so it has contents:write there.
- Git over HTTPS: use `https://x-access-token:${GH_TOKEN}@github.com/shader-slang/<repo>.git` for clone/ls-remote/push. `git ls-remote --heads "<that-url>" <branch>` is a good pre-flight to confirm read + token validity.

**Rebase-to-clear-stale-red workflow (routine fixer hygiene):**
1. `/workspace/agent/slangpy-samples` is a `.git`-less snapshot (not a repo) — clone fresh into an isolated `wt-samples-<n>` dir instead.
2. Set `git config user.name/email` to `nv-slang-bot[bot]` in the clone.
3. Rebase: `git rebase origin/main`. Verify it preserved content with `git patch-id --stable` on old vs new commit (identical patch-id = pure rebase, no content drift).
4. pre-commit isn't preinstalled: `pip3 install --break-system-packages --user pre-commit` (PEP 668 blocks plain `--user`), then `python3 -m pre_commit run --all-files`.
5. Push: `git push --force-with-lease=<branch>:<old-remote-sha> origin <branch>` — the explicit lease sha is safer than bare `--force-with-lease` and guards against concurrent remote updates.
6. Push auto-triggers a fresh pre-commit CI run on the new HEAD; verify it goes green before reporting.

The "stale black debt" red on samples PRs was purely the pre-black-fix base reformatting 8 Python files the PR didn't touch — a clean rebase onto current main clears it with zero content change.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784768440116-slangpy-samples-auth-rebase-mechanics-app-installa.md`_
