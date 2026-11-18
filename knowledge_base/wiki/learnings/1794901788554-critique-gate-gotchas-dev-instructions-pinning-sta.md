---
title: "Critique-gate gotchas: dev-instructions pinning, state resets on restart, in_reply_to for markers"
type: learning
topic: agent-ops
source: learnings/1794901788554-critique-gate-gotchas-dev-instructions-pinning-sta.md
---

# Critique-gate gotchas: dev-instructions pinning, state resets on restart, in_reply_to for markers

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1790786322738-0skp9l
written_at: 2026-11-17T07:49:48.554Z
---

# Critique-gate gotchas: dev-instructions pinning, state resets on restart, in_reply_to for markers

Two critique-gate mechanics that silently cost a #1195 session three full re-review passes (2026-11-17):

1. **A codex critique round is recorded ONLY if the call carries the canonical developer-instructions block verbatim** (sentinels "You are an independent reviewer" + "Return ONLY the structured output below" — track-critique.sh pins on these, and the response must contain a `### Verdict` heading line with the verdict word for the verdict to parse; "**Verdict: APPROVE**" in bold or prose is NOT parsed). Calling mcp__codex__codex with just a prompt silently drops the round — the gate then denies `gh pr create` with "missing critique stages" even though three reviews ran. Always pass the skill's developer-instructions block.

2. **The workflow-state file (`/workspace/.claude/workflow-state.json`) is wiped on every session/task restart** (e.g. HTTP-429 auto-retries, AUTO-ROUTE re-injections) — `critique_stages`, verdicts and attested hashes all vanish and the started_at/task_id change. If a delivery is denied with "missing critique stages" right after you recorded them, check `.task_id`/`started_at` — if new, re-run the three stages (compact round-1 re-recordings are fine; artifacts unchanged, codex re-verifies fast). Also: `codex-reply` continuation rounds do NOT update the OUTPUT_REVIEW attested-hash map and do NOT reset `edits_since_critique` — only fresh `mcp__codex__codex` STAGE calls do. So a file edited after its attestation (e.g. substituting a PR number into a comment template) needs a fresh STAGE call to re-attest, not a codex-reply.

Related: `gate-chain-routing.sh` requires `in_reply_to` on ANY message whose text starts with a delivery marker (e.g. [Fix Review Request]), even for a fresh peer delegation where the routing table says thread_id — pass `in_reply_to=<the parent dispatch msg id>` together with the explicit `to=<peer>`; delivery follows `to`.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794901788554-critique-gate-gotchas-dev-instructions-pinning-sta.md`_
