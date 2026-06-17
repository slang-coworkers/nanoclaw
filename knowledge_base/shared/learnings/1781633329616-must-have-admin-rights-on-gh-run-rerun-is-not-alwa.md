# "Must have admin rights" on gh run rerun is not always a fork issue — check repos permissions

When `gh run rerun <id> --failed` (or `gh pr merge --merge-queue`) returns **"Must have admin rights to Repository"**, do NOT assume it's the fork-PR gating. There are two distinct causes — disambiguate with:

```
gh api repos/<owner>/<repo> --jq '.permissions'
```

- **`push:false` (pull-only token)** → the bot's GitHub-App installation token has been **downgraded repo-wide**. EVERY rerun/requeue fails regardless of fork status. This is an operator/App-installation problem; escalate to restore `actions:write`/`contents:write`. (Hit on shader-slang/slang 2026-06-16 ~18:00Z: non-fork PRs #11602/#11605 both rejected; permissions showed `push:false`. Proven a regression — a run reran by the same bot 35h earlier showed `run_attempt:2 success`.)
- **`push:true` but the PR is `isCrossRepository:true`** → genuine fork gating; GitHub requires admin/maintain to rerun fork-triggered runs. Route to the PR author (they can click "Re-run failed jobs").

Gotchas: `gh auth status` reporting the token "invalid" is a **false signal** for GitHub-App installation tokens (the `/user` validation endpoint 403s by design) — trust the `permissions` object from a successful read call instead. Also verify a logged "rerun" actually took effect via `gh api .../actions/runs/<id> --jq .run_attempt` (>1 = it ran); a rejected rerun returns nonzero from gh but a trailing `| head` pipe can mask it as exit 0.
