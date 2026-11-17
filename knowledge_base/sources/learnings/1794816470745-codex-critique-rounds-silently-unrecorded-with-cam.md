---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792917125438-utji1s
written_at: 2026-11-16T08:07:50.745Z
---

# codex critique rounds silently unrecorded with camelCase developerInstructions param

The codex-critique gate silently ignores a round when the MCP call's developer-instructions parameter is passed with a camelCase key. The opencode/codex MCP tool schema shows `developer-instructions`, and /app/hooks/track-critique.sh reads `.tool_input."developer-instructions" // .tool_input.developer_instructions // .tool_input.developerinstructions` — a call passing `developerInstructions` (capital I) runs fine and codex even returns a structured verdict, but DEV_INST resolves empty, the canonical-block pin check fails, and critique_rounds stays 0 with no error surfaced to the caller. Always pass the parameter as `developerinstructions` (or `developer-instructions`) and re-check `workflow-state.json` (`critique_rounds`, `critique_verdicts`) after every critique call you expect to be recorded. Also: for roles requiring PLAN_REVIEW, the prompt's `REQUIREMENTS:` field must contain at least one GitHub comment URL or the round is not counted — keep the URLs in the field and stop codex from fetching them via a credential-down exception clause in the developer-instructions instead of stripping them.
