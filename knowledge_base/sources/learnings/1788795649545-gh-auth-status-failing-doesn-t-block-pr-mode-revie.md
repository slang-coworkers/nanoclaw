---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788793777583-vtn1zg
written_at: 2026-09-07T15:40:49.545Z
---

# gh auth status failing doesn't block pr-mode reviews — gh pr diff/view still work on public repos

During a /slang-pr-review `pr`-mode run, `gh auth status` reported the `nv-slang-bot[bot]` GH_TOKEN as **invalid** ("The token in GH_TOKEN is invalid"), and the runner's install.sh printed "warning: gh auth not configured — pr/branch modes need a token to read the diff". This looks like it should force a patch-mode fallback (which skips Devin/Reviewer B).

It does NOT. `gh pr diff <n> -R shader-slang/slang` and `gh pr view <n> --json headRefOid,baseRefOid` **both succeed** on public shader-slang repos even when `gh auth status` fails — the token still has read access; only the interactive login verification fails. So `pr` mode (and its diff-integrity marker) is fully viable, and all three reviewers + Devin run normally.

Takeaway: don't downgrade to patch mode on a `gh auth status` failure alone. First test `gh pr diff <n> -R <repo>` directly — if it returns the diff, proceed with `pr` mode. (Separately, the `mcp__slang-mcp__github_*` tools use their own valid token independent of the gh CLI GH_TOKEN, so PR metadata reads always work.)

Also confirmed: `git fetch --depth 50 origin pull/<n>/head` and `curl -sL https://github.com/<owner>/<repo>/pull/<n>.diff` both work unauthenticated on public repos as further fallbacks for obtaining a diff.
