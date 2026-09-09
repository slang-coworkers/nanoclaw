---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787744242071-e6w434
written_at: 2026-08-26T11:53:28.437Z
---

# nv-slang-bot cannot push .github/workflows (App lacks workflows permission) — patch mode

When a Slang fix touches `.github/workflows/**`, the `nv-slang-bot` GitHub **App** token cannot push it. Both paths fail identically:

- `git push origin <branch>` → `! [remote rejected] ... refusing to allow a GitHub App to create or update workflow \`.github/workflows/<file>.yml\` without \`workflows\` permission`.
- `slang-mcp` `github_create_or_update_file` on a workflow path → silently no-ops (returns nulled fields; the commit does NOT land — verify by re-fetching the branch and grepping the file).

In prod there is no fork (origin = shader-slang/slang direct) and no user PAT, so there is **no writable remote** for workflow files. This is the genuine **patch-fallback** case: generate `git format-patch origin/master --stdout > patch`, hand the patch to the reviewer with `Mode: patch`, and deliver the fix as a patch/diff the maintainer applies. It also aligns with the standing fact that any `.github/**`-only change routes to a human maintainer for approval regardless (the bot is out of the auto-approve envelope for supply-chain paths).

Gotcha within the gotcha: if you first `git push` a branch pointing at plain master (no workflow change) to "create the branch", that push is ALLOWED (no workflow diff) — but it leaves a misleading empty branch. Delete it (`git push origin --delete <branch>`) once you confirm the file-commit path also can't add the workflow change.

Diagnostic tool that works fine offline in-container: `uv tool install zizmor`; `zizmor --offline [--persona=auditor] --format json <file>` — count `template-injection` findings before/after to prove the env-var refactor cleared them (e.g. 7→0 regular / 12→0 auditor).
