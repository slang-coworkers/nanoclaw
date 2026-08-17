---
title: "claude-vs-codex-provider-parity"
type: learning
topic: agent-ops
source: learnings/1778085879531-claude-vs-codex-provider-parity.md
---

# claude-vs-codex-provider-parity

# Claude vs Codex provider parity — empirical findings (2026-05-06)

From a 10-probe stress test on `AGENT_RUNTIME=local` install (PR #52 `skill/remove-docker-v2@84ae3e5`), using a persistent-socket harness to dodge CLI single-client eviction.

## Functional parity — mostly yes
- ✅ Connectivity, MCP tool calls (deepwiki, schedule_task, cancel_task), error path — all work on both providers.
- ✅ Both get the same `mcpServers` config from agent-runner (`container/agent-runner/src/index.ts:104,171`) — MCP surface is identical.
- ✅ Both pick up `.instructions.md` + `CLAUDE.md` content at session start (Codex via `resolveClaudeImports` in `codex.ts:27`; Claude via SDK native).

## Three real asymmetries

### 1. Native `Task` subagent — Claude only
`Task` is in Claude SDK's `allowedTools` (`providers/claude.ts:47`). Codex has no equivalent; under test it **hung 150s silently** rather than returning "unavailable". Both providers do have `mcp__nanoclaw__create_agent` + a2a messaging (`src/modules/agent-to-agent/index.ts:24`) — that's the portable subagent path.

### 2. Rapid message queueing — Claude merges, Codex keeps distinct
P7 (10 messages alternating providers, Promise.all):
- Codex: 5/5 tagged replies
- Claude: **1/5** tagged replies (4 timeouts)

Cause: Claude SDK's `stream.push` into an active turn coalesces pending messages into ONE result event. Codex app-server emits one result per push.

**How to apply:** if you're fanning out messages to a Claude coworker and need per-message reply identity, either wait for the prior turn to finish OR open separate sessions. For Codex, rapid-fire is fine.

### 3. Latency — Codex consistently faster per probe
- P1: 4.0s vs 5.3s (Codex 25% faster)
- P2: 5.0s vs 37.4s (Codex 87% faster)
- P3: 15.0s vs 24.1s (Codex 38% faster)
- P9: 7.0s vs 8.0s (Codex 12% faster)

Likely Claude Opus prompt-caching + thinking blocks adding latency, while Codex/nvinference has lower TTFT.

## Blocked on local runtime (not a provider difference)

- **Plan-gate / critique-gate** do NOT fire under `AGENT_RUNTIME=local` (`src/container-runner.ts:730-736` explicit skip with comment *"Local agents run without overlay hook enforcement (documented limitation)"*). P5 is categorically untestable on a local install.
- **CLAUDE.md / .instructions.md @import** can't be verified on a live session — the running coworker caches its system prompt. Test requires kill + fresh session spawn.

## Gotchas for harness authors

- CLI adapter is **single-client** (`src/channels/cli.ts:152`): parallel `pnpm run chat` evicts each other. Use one persistent socket + in-band tags to identify replies.
- CLI server strips message ids — embed `TAG-<id>` in the prompt and grep the reply.
- Router evaluates each wired mga row independently (`src/router.ts:239`) — one inbound message can wake N coworkers if N engage patterns match.

## References
- Plan: `/workspace/agent/plans/claude-vs-codex-stress-test.md`
- Report: `/workspace/agent/reports/claude-vs-codex-stress-2026-05-06.md`
- Harness: `scripts/stress-harness.ts` (uncommitted)
- Raw events: `data/stress/*/events.jsonl` (153 events)

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1778085879531-claude-vs-codex-provider-parity.md`_
