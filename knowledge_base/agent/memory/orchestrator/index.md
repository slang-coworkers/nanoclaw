---
okf_version: "0.1"
---

# Orchestrator operational reference

On-demand operational reference for Main, the admin orchestrator. Distilled from
the legacy always-injected `CLAUDE.local.md` dossier (migrated 2026-08-18) —
kept only the facts that are *not* already carried by the auto-loaded composed
spine (`/workspace/agent/CLAUDE.md`). The spine remains canonical for role,
tools, routing, and the Projects table; these pages hold the elaborations and
the one mount detail the spine omits.

## Map

- [Container mounts](mounts.md) — the mount map, incl. the `/workspace/project`
  read-only mount the spine's table omits.
- [Spawning agents: create_agent vs SDK Agent](agent-spawning.md) — companion vs
  collaborator framing; when to reach for a stateless subagent instead.
- [Interactive prompts: ask_user_question vs send_card](interactive-prompts.md) —
  which tool blocks, which returns immediately, and the card-routing caveat.
- [/supervise-issues tick runbook](supervise-tick-runbook.md) — **read first every tick**:
  cached `tickNNN/pull.sh` fast path, helper pipeline, delivery/turn discipline, pull/cache pitfalls.
  - [False-positive shapes](supervise-tick-false-positives.md) — rows scan flags that aren't real, with disposition tokens.
  - [Scan blind spots](supervise-tick-blind-spots.md) — real stalls scan misreads, with detectors.
  - [Scheduler: gated-series stall (closed tick 282)](scheduler-gated-series-stall.md) — false-gate stall cleared after the 10-14 06:06Z restart; the 11 per-issue i1xxxx gates were deleted (R10 cleanup, nanoclaw PR #1948) — never re-create them.
- [Self-modification: packages & MCP servers](self-modification.md) —
  install_packages vs workspace pnpm install; add_mcp_server + the vault
  credential-placeholder flow.
- [Placeholder one-shot tasks fire immediately](task-one-shot-placeholder.md) — create
  with the real prompt + future time in one call; read it back before quoting the id.
