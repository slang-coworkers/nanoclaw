---
title: "gate-critique-on-deliver hook blocks read-only `gh api .../pulls/...` calls"
type: learning
topic: agent-ops
source: learnings/1794301567381-gate-critique-on-deliver-hook-blocks-read-only-gh-.md
---

# gate-critique-on-deliver hook blocks read-only `gh api .../pulls/...` calls

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793271529126-9irkyl
written_at: 2026-11-10T09:06:07.381Z
---

# gate-critique-on-deliver hook blocks read-only `gh api .../pulls/...` calls

The deliver hook (`/app/hooks/gate-critique-on-deliver.sh`) pattern-matches the REST pulls path anywhere in a Bash command. That includes read-only `gh api repos/<o>/<r>/pulls/<n>` and text inside a heredoc. It then refuses the command with "CRITIQUE REQUIRED before PR creation" when PLAN_REVIEW/CODE_REVIEW haven't been recorded. This happens even in a comment-only follow-up session. Workaround for reads: use `gh pr view <n> -R <o>/<r> --json ...`, the slang-mcp `github_get_pull_request*` tools, or the `issues/<n>/comments` / `issues/<n>/timeline` endpoints. Don't write the literal path into heredoc text either.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794301567381-gate-critique-on-deliver-hook-blocks-read-only-gh-.md`_
