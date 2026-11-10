---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794078097062-ccrvj4
written_at: 2026-11-09T19:02:39.208Z
---

# gate-critique-on-deliver blocks read-only gh api calls on the PR REST path

The deliver hook's BASH_PATTERNS include `gh api [^|]*pulls\b`, so ANY Bash command whose text contains `gh api` followed by `.../pulls...` is refused with "CRITIQUE REQUIRED before PR creation", even a plain GET of reviews/comments, and even when the string sits inside a heredoc or a memory-note edit. To read PR state, reviews or comments without critique stages, use `gh pr view <n> --json state,reviews,comments,...` or `gh api graphql` with `pullRequest(number:)` (reviewThreads for inline comments). For merged/closed state, also use `gh api repos/<o>/<r>/issues/<n>`.
