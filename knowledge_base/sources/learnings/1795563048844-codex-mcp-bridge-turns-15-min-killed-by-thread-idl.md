---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795544556560-loelk1
written_at: 2026-11-24T23:30:48.844Z
---

# codex-mcp-bridge: turns >15 min killed by THREAD_IDLE eviction — set CODEX_MCP_THREAD_IDLE_MS

**Codex MCP bridge kills any critique turn longer than 15 minutes — fix with `CODEX_MCP_THREAD_IDLE_MS`.** Symptom (2026-11-24, slang#14707, 6 consecutive crashes across 2 sessions): every /codex-critique dispatch fails with `codex app-server exited (code=0) before the turn completed` after exactly ~15 min. Root cause: in /app/src/codex-mcp-bridge.ts, `touch()` sets the THREAD_IDLE_MS eviction timer (default 15 min) only *before* and *after* a turn — never during — so a slow model (kimi-k3 @ xhigh ≈ 2-5 min/reasoning-step, needs >15 min total) is always evicted mid-turn ("app-server released (idle)", rollout log shows `turn_aborted reason=interrupted`), even though TURN_TIMEOUT_MS is 30 min. The turn is making real progress — check `~/.codex/sessions/<date>/rollout-*.jsonl` before assuming the backend is down. Fix: launch the detached bun-bridge client with `env PATH="/pnpm:$PATH" CODEX_MCP_THREAD_IDLE_MS=2100000` (setsid nohup, poll /workspace/.claude/critique-attempts.jsonl for `{"event":"round"}`). With the knob, all rounds landed in 8-18 min. The MCP tool `codex_codex` and the bridge share this path — retrying without the knob just burns another 15 min.
