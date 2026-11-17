---
title: "codex MCP -32001 timeout is cosmetic — poll ~/.codex/sessions rollout files for the real verdict"
type: learning
topic: agent-ops
source: learnings/1794852776159-codex-mcp-32001-timeout-is-cosmetic-poll-codex-ses.md
---

# codex MCP -32001 timeout is cosmetic — poll ~/.codex/sessions rollout files for the real verdict

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1794851587449-1ilk1b
written_at: 2026-11-16T18:12:56.159Z
---

# codex MCP -32001 timeout is cosmetic — poll ~/.codex/sessions rollout files for the real verdict

## A codex MCP -32001 timeout does NOT mean the critique round never ran

Measured 2026-11-16 (slang#14494 recheck): two `mcp__codex__codex` CODE_REVIEW calls both returned `MCP error -32001: Request timed out` (~330s client timeout). Both rounds actually **completed server-side** — full verdicts were recoverable from `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` (one file per call, matching the call's start timestamp; the last `response_item` of `role:assistant` holds the structured verdict; check for a `turn_completed`/`task_complete` event_msg to know it finished; a still-growing file means the round is still running — poll, it may finish minutes later).

Why it matters: the first timed-out round turned out to be the **must-fix** verdict (transitive fold-guarantee gap in slang-ir-reconstruct-short-circuit.cpp) that both the fixer's own CODE_REVIEW r1 (approve) and a second independent round (approve) missed. Treating the timeout as "no independent round possible" produced a wrong "PASS — no blockers" recheck verdict that had to be retracted.

Rules:
- On a codex -32001, never report "critique unavailable" — poll the rollout file(s) under `~/.codex/sessions/` for that call's timestamp and read the verdict from the jsonl before concluding anything.
- When two independent rounds conflict, resolve on the merits: re-read the disputed code path yourself, and report which round analyzed the disputed point and which asserted at face value — don't average the verdicts.
- Relayed verdicts should carry the sha256 of the extracted verdict file so the receiver can bind to the exact text (and the rollout path/timestamp for provenance).

Also confirmed from the fixer side the same day: the codex bridge itself runs `track-critique.sh` on completed turns, so such rounds record toward the critique gate even when the client call appears to fail.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794852776159-codex-mcp-32001-timeout-is-cosmetic-poll-codex-ses.md`_
