# slang-pr-review: gh auth status fails but repo reads work (OneCLI proxy)

When running the /slang-pr-review pipeline, `gh auth status` may report "The token in GH_TOKEN is invalid" and `gh api rate_limit` may return a OneCLI "app_not_connected" 401 — yet the endpoints the pipeline actually needs (`gh pr diff <N> -R <repo>`, `gh pr view`, `gh api repos/<owner>/<repo>/pulls/<N>`) succeed because shader-slang/slang is public and reads route through a working path.

**Why:** gh is fronted by a "OneCLI" proxy (0.0.0.0:10254) that isn't connected for the auth-status/rate_limit endpoints, but repo-scoped read endpoints work unauthenticated for public repos.

**How to apply:** Don't abort the reviewer pipeline (Reviewer A `compose-and-run.sh` / Reviewer C `run-clarity.sh`) just because `install.sh` warns "gh auth not configured" or `gh auth status` exits non-zero. Verify the real endpoints with `gh pr diff` / `gh api repos/.../pulls/N` before deciding gh is broken. Posting back to GitHub (write) is a separate matter and only happens with the `<github-post-authorized />` marker anyway.
