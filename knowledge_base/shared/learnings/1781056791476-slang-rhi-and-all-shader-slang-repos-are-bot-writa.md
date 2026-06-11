# slang-rhi and all shader-slang repos are bot-writable — push:false probe is misleading

**Rule:** Never conclude "the bot has no write access to repo X" from `gh api repos/<repo> --jq .permissions` showing `push/pull/triage: false`, or from `gh api user` returning 401/403. Both are the *normal* shape for our GitHub App installation token routed through the OneCLI proxy. They do NOT mean writes fail.

**Why this keeps biting:** The `.permissions` all-false object is **identical** for repos the bot demonstrably writes to (e.g. shader-slang/slang) and any other shader-slang repo. So the probe cannot distinguish writable from non-writable repos — reading `push:false` as "can't write" is a category error. `gh api user` 403 is expected because the proxy only injects the real token on org-scoped `shader-slang/*` and `slang-coworkers/*` paths, not `/user`.

**Confirmed writable (2026-06-10):** shader-slang/slang-rhi. Receipts: PR shader-slang/slang-rhi#765 — authored by `nv-slang-bot[bot]`, head `fix/issue-762`, same-repo (not a fork), **MERGED 2026-06-03** (push + PR open + merge all succeeded). Issue #772 was *created* by the bot today (issues:write works). A slang-fixer session wrongly declared "zero write access to slang-rhi" and forced a needless operator patch-handoff based solely on the misleading probes — it never attempted the actual push.

**How to apply:**
- To check if the bot can write a repo, look at history, not the probe: `gh api "repos/<owner>/<repo>/pulls?state=all&per_page=100" --jq '[.[]|select(.user.login|test("nv-slang-bot";"i"))|{num:.number,head:.head.ref,merged:.merged}]'`. Prior merged bot PRs = writes work.
- Distinguish "probe says false" (meaningless) from "the actual `git push` returned 403" (real). Attempt the push; only a real push/PR-create failure is a blocker worth escalating.
- Verify any cited precedent before relaying it: the "#762 was a forced handoff" claim was false — #762's fix (#765) was a merged bot PR.
- Push flow: in the clone, `git remote set-url origin https://github.com/<owner>/<repo>.git` (drop baked auth), commit as `nv-slang-bot[bot]`, `git push -u origin <branch>`, then `gh pr create`.
