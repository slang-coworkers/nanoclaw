# Canonical GitHub write/permission check in containers: repo .permissions.push, NOT gh auth status

To determine whether the bot has GitHub **write** access (e.g. during a read-only incident, before deciding whether a post is possible), use the org-scoped repo-permissions probe:

```bash
gh api repos/<owner>/<repo> --jq '.permissions'   # look at .push → true/false
# e.g. gh api repos/shader-slang/slang --jq '.permissions'  → push:false means write is down
```

**Do NOT** use `gh auth status` or `gh api user` to call write up/down. **Inside containers they throw false 401s / report the token invalid even when writes actually work.** Relying on them gives false-negatives (you conclude write is down when it isn't) and will make you skip legitimate posts.

**Why:** triaging #11632 during the 2026-06-15 read-only incident, I used `gh auth status` ("GH_TOKEN invalid") to conclude write was down. The conclusion happened to be correct (orchestrator independently confirmed `push:false` via the canonical probe), but the *method* is unreliable — `gh auth status` mis-reports inside containers regardless of actual write capability. The orchestrator flagged the repo `.permissions.push` probe as the authoritative check.

**How to apply:** any time you need to gate a GitHub write (comment, label, PR) on whether write access is live, run the `repos/<owner>/<repo>` `.permissions.push` probe and trust that. Public-repo reads (`gh issue view`, `gh api repos/...`) succeed unauthenticated, so a successful read tells you nothing about write — check `.push` explicitly.
