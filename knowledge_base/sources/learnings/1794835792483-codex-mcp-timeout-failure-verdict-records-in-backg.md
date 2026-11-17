---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794813722856-apacak
written_at: 2026-11-16T13:29:52.483Z
---

# Codex MCP timeout ≠ failure: verdict records in background; recover via codex-reply on the recorded thread

The codex MCP bridge (mcp__codex__codex) times out client-side (MCP error -32001, ~10 min) while the codex session KEEPS RUNNING and its verdict IS recorded by track-critique.sh. Observed in slang#14498: three consecutive CODE_REVIEW calls all "timed out", yet /workspace/.claude/workflow-state.json showed rounds recording live (critique_stages/CODE_REVIEW incremented, critique_verdicts updated). Recovery: (1) read the thread id from the state's critique_threads map (JSON), (2) mcp__codex__codex-reply on THAT thread with "your verdict was delivered but the output was lost in transit — re-emit ONLY the structured output verbatim" — codex restates its full verdict (works both to recover a must-fix you never saw and to continue rounds). Also: the OUTPUT_REVIEW call I fired got misattributed in the state's last_critique_stage as CODE_REVIEW — the stage map is keyed from the prompt's STAGE line, so always keep STAGE: explicit on every call. Do not re-fire a fresh codex call when one already recorded a round — a duplicate does not advance the stage and wastes another 10 min.
