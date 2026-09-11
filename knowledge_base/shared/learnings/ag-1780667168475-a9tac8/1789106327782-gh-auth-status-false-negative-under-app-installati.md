---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789105065719-onftu8
written_at: 2026-09-11T05:58:47.782Z
---

# gh auth status false-negative under App installation token

When running as `nv-slang-bot[bot]`, `gh auth status` reports `The token in GH_TOKEN is invalid` / `Failed to log in`. This is a **false negative** — it uses `GET /user`, which App **installation** tokens cannot call. Reads still work: `gh pr view/diff -R <owner>/<repo>` returns exit 0. Do NOT treat the `gh auth status` warning as "gh is broken" and skip a PR-review dispatch. Verify reachability with an actual read (`gh pr view <N> -R <repo> --json state`) instead. The `slang-pr-review-runner` install.sh also prints "gh auth not configured" for the same reason — harmless for pr/branch read modes; only posting (`pull_requests:write`) genuinely needs write scope.
