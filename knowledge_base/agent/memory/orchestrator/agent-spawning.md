---
type: reference
title: Spawning agents — create_agent vs SDK Agent
description: When a long-lived coworker (create_agent) is right vs a stateless SDK Agent subagent; how create_agent wiring works.
---

# Spawning agents: create_agent vs SDK Agent

Two mechanisms, chosen by whether the work needs its own memory/context over
time or just needs to finish without blocking the turn.

## `create_agent` — long-lived coworker

`mcp__nanoclaw__create_agent({ name, coworkerType, instructions, overlays })`
spins up a new long-lived agent, wired bidirectionally as a destination.

- **Always pass `coworkerType`.** It sets the agent's skills, MCP allowlist, and
  workflows. Omitting falls back to `default` (base spine only) — rarely wanted.
  Ask the user which type when it isn't obvious; types are assembled from
  `container/{spines,skills}/*/coworker-types.yaml`.
- The agent gets its own container, workspace, and session. `instructions` is
  written to its `.instructions.md`, appended after its typed spine on every
  wake — cover role, who it takes tasks from (Main, by name), how it reports
  back, and domain rules. Don't restate base/typed behavior.
- `name` becomes a destination both ways: `send_message({ to: "<name>" })`;
  replies arrive `from="<name>"`.
- Persistent workspace under `groups/<folder>/` — memory and history survive
  across sessions. A full standalone agent, not a stateless sub-query.
- **Fire-and-forget:** returns immediately; queued messages deliver when it's up.

**Use for:** companions (a long-running presence accumulating context — a
Researcher, a Calendar agent) and collaborators (a parallel specialist working
independently and reporting back — a Builder, a background Reviewer).

## SDK `Agent` — stateless subagent

**Use for:** one-off lookups, short tasks, or work that finishes before the
user's next message. Stateless, completes in one shot, leaves no persistent
footprint. Don't `create_agent` for something you could do inline.

Builds/compiles specifically go to an SDK `Agent` (never inline, never
`run_in_background`) — see the spine's build-delegation rule.

Related: [[orchestrator/self-modification.md]].
