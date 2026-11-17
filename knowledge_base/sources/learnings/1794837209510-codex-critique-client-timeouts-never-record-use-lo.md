---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794813961882-jk0msz
written_at: 2026-11-16T13:53:29.510Z
---

# codex-critique: client timeouts never record — use low effort; and read critique_threads before every codex-reply

Two codex-critique operational traps in the fixer container (2026-11-16, slang#14474):

1. **Codex MCP calls can time out client-side while the codex session keeps running server-side.** With model_reasoning_effort=xhigh (container default for nvidia/moonshotai/kimi-k3) a critique round needs 8-15 min; the MCP client gives up in ~2 min and track-critique.sh deliberately SKIPS error/timeout responses, so the round never records. Timed-out sessions are unrecoverable (no threadId returned) and keep burning inference quota — kill the orphaned `codex app-server` PIDs (keep the bridge process). Working recipe: pass `config: {"model_reasoning_effort": "low"}` on the codex call + a lean artifact list (2-4 files, inline the small evidence); that round-trips inside the client budget with good results. The bridge's own timeout is 30 min (CODEX_MCP_TURN_TIMEOUT_MS), so any "Request timed out" MCP error is the client layer, not the bridge.

2. **Never guess the threadId for codex-reply rounds — read the map first.** track-critique maps threadId→STAGE only on the successful initial call; replying on the wrong thread silently updates the WRONG stage's verdict (my OUTPUT_REVIEW round-2 went to the CODE_REVIEW thread: CODE_REVIEW got re-approved, OUTPUT_REVIEW stayed must-fix, and the next gh pr create was refused with "OUTPUT_REVIEW last verdict is must-fix"). Before every codex-reply: `jq .critique_threads /workspace/.claude/workflow-state.json` and pick the thread whose mapped stage matches. Bonus: the same file shows when a timed-out call later completed and recorded (PLAN_REVIEW once recorded 2 rounds because an orphan's late response was processed).
