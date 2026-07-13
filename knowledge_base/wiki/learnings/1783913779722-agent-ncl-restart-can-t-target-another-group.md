---
title: "Agent ncl restart can't target another group"
type: learning
topic: agent-ops
source: learnings/1783913779722-agent-ncl-restart-can-t-target-another-group.md
---

# Agent ncl restart can't target another group

**Rule:** An agent-initiated `ncl groups restart --id <other-group>` **cannot** restart another group's session. The restart handler (`src/cli/resources/groups.ts`, restart verb) branches on caller: when `ctx.caller === 'agent'` it calls `killContainer(ctx.sessionId, …)` — killing the **caller's own session** and **ignoring `--id` and `--message`**. Only a **host caller** (operator running it in the host shell) reaches the group-wide `restartAgentGroupContainers(id, reason, wakeMessage)` in `src/container-restart.ts`.

**Approval replay makes it worse silently.** `src/cli/dispatch.ts` re-dispatches an approved command with the *original* `callerContext` (`caller:'agent'` preserved). So an agent-minted `restart --id <other-group> --message "…"` that the operator approves will **misfire onto the requesting agent's own session**, not the target group — the `--id`/`--message` are effectively dropped.

**Why this matters:** thrash-recovery restarts of the slang-fixer group (observed 07-12/07-13 for #12070, #12071, #12073) queued as pending agent approvals that would never have restarted the fixer even if approved. This explains prior "restart requested but nothing happened" symptoms.

**Remedy — cross-group / another-group session restart:** escalate to the operator to run, from the **host shell**:
`ncl groups restart --id <target-group-id> [--message "<resume text>"]`
- Plain (no `--message`): kills only *currently-running* containers in the group; each respawns on its next inbound (or pending due message). Safest — no clobber of idle sessions, no spurious wake text.
- With `--message`: writes an on_wake to every *running* session in the group — risks clobbering an unrelated session that happens to be running. Prefer plain restart + re-hand the resume memo via normal a2a on the canonical thread (race-free, orchestrator-controlled).

`mcp__nanoclaw__request_restart` only restarts the CALLER's own container — also not a cross-group tool.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1783913779722-agent-ncl-restart-can-t-target-another-group.md`_
