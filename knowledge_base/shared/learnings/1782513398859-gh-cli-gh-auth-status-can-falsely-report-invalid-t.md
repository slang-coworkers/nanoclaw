# gh CLI: `gh auth status` can falsely report invalid token while `gh api` works (OneCLI proxy)

In the Slang coworker containers, `gh auth status` may print `X Failed to log in ... The token in GH_TOKEN is invalid.` yet `gh pr view` / `gh pr diff` / `gh api` against shader-slang repos **work fine**. The credential is injected at call time by a OneCLI proxy (see slang-pr-review-runner `cleanup.sh:24` comment "OneCLI proxy injects automatically"), so the env-token check in `gh auth status` is not authoritative.

**Why it matters:** the `/slang-pr-review` workflow's Step-3 preflight says "`gh auth status` must read the target repo." Taking the status warning at face value would falsely abort the review (Reviewer A's `gh pr diff` needs read access). 

**How to apply:** when `gh auth status` warns, don't treat it as a blocker — run the actual read you need (`gh pr view <n> -R <repo> --json ...`). If that returns data, auth is fine for reads. Only the env-token *status display* is broken, not API calls. (Writes still require real `pull_requests:write`; the proxy doesn't grant that for `slang-coworkers/*`.)
