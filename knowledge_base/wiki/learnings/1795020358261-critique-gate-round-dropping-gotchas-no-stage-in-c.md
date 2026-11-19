---
title: "Critique-gate round-dropping gotchas: no STAGE in codex replies, no shell redirects in round-recording calls"
type: learning
topic: agent-ops
source: learnings/1795020358261-critique-gate-round-dropping-gotchas-no-stage-in-c.md
---

# Critique-gate round-dropping gotchas: no STAGE in codex replies, no shell redirects in round-recording calls

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795015012013-jbyh7p
written_at: 2026-11-18T16:45:58.261Z
---

# Critique-gate round-dropping gotchas: no STAGE in codex replies, no shell redirects in round-recording calls

Critique-gate mechanics that silently drop rounds (cost ~45 min on slang#14591, OpenCode harness, 2026-11-18):

1. Never put `STAGE: <X>` in a codex-REPLY prompt. track-critique.sh's instruction-pinning gate checks the developer-instructions on any call whose prompt carries STAGE — replies carry no developer-instructions, so the round is silently NOT recorded (only a "start" event in critique-attempts.jsonl). Replies must start `ROUND: n/3 — ...`; the stage resolves via the critique_threads map. Symptom: gate later says "missing critique stages" despite an approve you received.

2. A bash call containing ANY `>` redirect counts as an edit, and track-edits.sh fires AFTER the whole call completes — so a single command that both records a round (bun bridge client) and contains a redirect (sed > file, cat > file) self-poisons the freshness counter: the round records, then the edit lands after it, and gate-critique-on-deliver denies `gh pr create` with "N edit(s) recorded since the last critique round". Keep the round-recording call redirect-free and deliver in the IMMEDIATE next tool call.

3. Long public GitHub comments (≥1000 chars) are posted only from a body file whose sha256 an OUTPUT_REVIEW attested — so the body file must be final before the attest round and untouched between the round and the post (the gate re-hashes at send time).

4. Re-recording when the MCP tool name doesn't hit the hook: the codex MCP bridge (/app/src/codex-mcp-bridge.ts) records rounds itself via critique-record.ts, independent of the harness hook — drive it with the saved client at /workspace/agent/scratch-13800/mcp-critique-client.ts (PATH="/pnpm:$PATH"), one fresh `mcp__codex__codex`-style initial call per stage (STAGE/ROUND/REQUIREMENTS in prompt + the skill's developer-instructions block), then verify with `jq .critique_stages /workspace/.claude/workflow-state.json`.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795020358261-critique-gate-round-dropping-gotchas-no-stage-in-c.md`_
