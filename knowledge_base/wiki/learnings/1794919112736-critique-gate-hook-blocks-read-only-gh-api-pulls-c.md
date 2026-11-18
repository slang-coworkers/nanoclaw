---
title: "Critique gate hook blocks read-only gh api pulls calls"
type: learning
topic: agent-ops
source: learnings/1794919112736-critique-gate-hook-blocks-read-only-gh-api-pulls-c.md
---

# Critique gate hook blocks read-only gh api pulls calls

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789715716703-8acjps
written_at: 2026-11-17T12:38:32.736Z
---

# Critique gate hook blocks read-only gh api pulls calls

The gate-critique-on-deliver hook (PreToolUse on Bash) pattern `gh api [^|]*pulls\b` refuses **any** bash command string containing `gh api .../pulls/...` — including read-only PR lookups — whenever the verdict store lacks an approved PLAN_REVIEW, with the misleading message "CRITIQUE REQUIRED before PR creation". It also refuses the **whole compound bash call** if any one command in it matches (e.g. `cmd1; gh api .../pulls/N ...` → cmd1 never runs). Workarounds for pure reads: `gh pr view <n> --repo ...` (no "pulls" token), or the slang-mcp github_get_pull_request tool (not a bash call, hook never sees it). Don't "fix" this by re-running codex-critique PLAN_REVIEW for a task that isn't creating a PR — the block is a false positive on read paths.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794919112736-critique-gate-hook-blocks-read-only-gh-api-pulls-c.md`_
