---
title: "'The MCP tool is missing' ≠ 'the capability is missing' — check `ncl <resource> help` before declaring a gap"
type: learning
topic: agent-ops
source: learnings/1785779165007-the-mcp-tool-is-missing-the-capability-is-missing-.md
---

# "The MCP tool is missing" ≠ "the capability is missing" — check `ncl <resource> help` before declaring a gap

## Rule

Before reporting a capability gap or asking for tooling to be wired, check whether the capability already exists on **another surface**. Specifically: an absent `mcp__nanoclaw__*` tool does **not** mean the capability is unavailable — the same function is often reachable via **`ncl <resource>`**, gated by your group's `cli_scope` rather than by the MCP allowlist.

**Run `ncl <resource> help` (and `ncl help`) before saying "I can't."**

## The why (slang#10918, 2026-08-03)

A fixer lost **five days** to two turns that ended trusting an in-session `Monitor` to survive container teardown (it doesn't — the builds died silently, unfired). Diagnosing that, it looked for a durable scheduler, probed for `mcp__nanoclaw__schedule_task`, got *"No such tool available"*, and reported a **capability gap** needing operator wiring.

The capability was there the whole time. Its `cli_scope` is `group`, which grants **`ncl tasks`**: `create | list | get | update | cancel | pause | resume | run | delete` — one-shot via `--process-after`, cron via `--recurrence`. It even had the exact feature wanted: **`--script` runs *before* the agent wakes, and a `wakeAgent:false` fire costs zero tokens**, so an idempotent "has the build finished / has the head moved?" poll is free. No MCP wiring needed.

Two surfaces, two different gates:
- **MCP tools** — gated by the per-group `allowedMcpTools` / `mcp_servers` config.
- **`ncl`** — gated by `cli_scope` (`disabled` | `group` | `global`). With `group` you get `groups`, `sessions`, `destinations`, `members`, **`tasks`** for your own group.

So "tool not in my toolset" answers a question about *one* surface, and it is routinely mistaken for an answer about the *system*.

## How to apply

- Symptom: you're about to write "X is not in my toolset" / "this needs operator wiring." **Stop and run `ncl help`, then `ncl <resource> help`.**
- For durable scheduling of long builds specifically: **`ncl tasks create`** with `--process-after` (one-shot) or `--recurrence` (cron), plus `--script` for a zero-token guard so the agent only wakes when there's something to do. This survives container teardown; in-session `Monitor`s and background shells do **not**.
- Blocking in-turn on the build remains simpler and correct when the build fits inside one turn. Reach for a task when it doesn't.
- When you *do* report a gap, say which surfaces you checked. "No MCP tool and `ncl tasks help` shows nothing" is a real gap report; "no MCP tool" alone is a guess.

## Generalization

This is a **false-scarcity** error, and it's the mirror of the session's dominant family (a green signal silent about the failure you care about). Here a *negative* signal — "No such tool available" — was read as broader than it was. Same corrective in both directions: **name exactly what your probe would and would not have detected before drawing the conclusion.** A probe of one surface cannot license a claim about all of them.

Related: [[feedback_in_session_monitors_dont_survive_teardown]] (the failure that prompted the search), and the "verify the mechanism applies to *their* path" rule — both are about not over-generalizing from a partial probe.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785779165007-the-mcp-tool-is-missing-the-capability-is-missing-.md`_
