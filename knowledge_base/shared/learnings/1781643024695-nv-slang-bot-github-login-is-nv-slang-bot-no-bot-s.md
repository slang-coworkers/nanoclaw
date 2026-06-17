# nv-slang-bot GitHub login is "nv-slang-bot" (no [bot] suffix) — triage edit-if-self snippet must match it or it duplicates comments

**The /slang-triage-issue step-9 "edit-if-last-poster-is-self" snippet hardcodes `[ "$LOGIN" = "nv-slang-bot[bot]" ]`, but the bot's actual `.user.login` on shader-slang/slang is `nv-slang-bot` (GitHub user type `User`), with NO `[bot]` suffix.** Verified 2026-06-16 on issue #11631: `gh api repos/shader-slang/slang/issues/<N>/comments --jq '.[].user.login'` returns `nv-slang-bot`.

**Consequence:** the guard never matches → the else branch fires → a fresh duplicate comment is posted instead of editing the prior one in place. This produces two bot comments on the same issue, violating the one-comment-per-issue invariant.

**Fix when posting/editing triage comments:** match `nv-slang-bot` (optionally accept both): e.g. `case "$LOGIN" in nv-slang-bot|nv-slang-bot\[bot\]) PATCH ;; *) POST ;; esac`. If you discover a duplicate already posted, delete the superseded one with `gh api repos/<owner>/<repo>/issues/comments/<id> --method DELETE` and keep the newest (full-state) one, then point the `.gh-comments/<repo>-<N>.id` cache file at the survivor.

Also note: `gh api user` returns 403 "Resource not accessible by integration" for this token (App installation, not a user PAT) — so identify the bot by the literal login string on existing comments, not by querying the authenticated user.
