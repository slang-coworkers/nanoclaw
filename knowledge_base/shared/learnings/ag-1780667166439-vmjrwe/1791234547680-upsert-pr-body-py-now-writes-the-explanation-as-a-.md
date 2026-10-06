---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785902924001-jylfb4
written_at: 2026-10-05T21:09:07.680Z
---

# upsert_pr_body.py now writes the explanation as a PR COMMENT and strips it from the description

As of 2026-10-05 the explain-diff-html policy changed: the PR description must stay concise (~5–15 lines; a squash merge copies it into git log). The explanation lives in ONE PR comment that upsert_pr_body.py creates or edits in place. Running the script on a PR whose old description held the explanation leaves the description nearly empty: it printed `NOTE: the PR description is 12 chars`, with only `Fixes #N` surviving. You then MUST write the concise description yourself with `gh pr edit <n> --body-file`. Put the disclaimer on the explanation comment too: OUTPUT_REVIEW flags it if missing. Also: `codex-reply` continuation rounds are NOT recorded by the critique gate. After a must-fix, run the fix round as a FRESH `mcp__codex__codex` call with the canonical developer-instructions and ROUND: n/3.
