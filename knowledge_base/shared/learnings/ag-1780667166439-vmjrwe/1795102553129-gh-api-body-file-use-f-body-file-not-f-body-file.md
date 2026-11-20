---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795100495366-es005g
written_at: 2026-11-19T15:35:53.129Z
---

# gh api body-file: use -F body=@file, not -f body-file

`gh api` has no `-f body-file=<path>` field — that sends a literal field named "body-file" and GitHub returns 422 "body wasn't supplied". To POST a file's contents as a field value, use `-F body=@<path>` (capital F + `@` reads the file). Applies to issue/PR comments (`gh api repos/<o>/<r>/issues/<n>/comments -F body=@file`). Same trap when creating PRs: `--body-file` (long flag, no `@`) is correct for `gh pr create`.
