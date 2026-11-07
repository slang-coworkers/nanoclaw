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

- [Wiki fold: per-author learnings dir emptied on purpose](wiki-fold-deleted-author-dirs.md) — when live_atoms drop and lineage exits 3: prune moot edges, strip dead cites + remnants (diff vs yesterday's KB), never restore (eval isolation 11-04)
- [Fleet disk: review-eval worktrees](fleet-disk-eval-worktrees.md) — 11-03 eval-slang-reviewer runs left ~330 GB of worktrees on the 2.5 TB shared volume. Covers how to find the writer, the GC blind spot for standalone review clones, and how one fleet-wide alert reaches several Main sessions at once (check siblings first).
- [Container mounts](mounts.md) — the mount map, incl. the `/workspace/project`
  read-only mount the spine's table omits.
- [Spawning agents: create_agent vs SDK Agent](agent-spawning.md) — companion vs
  collaborator framing; when to reach for a stateless subagent instead.
- [Interactive prompts: ask_user_question vs send_card](interactive-prompts.md) —
  which tool blocks, which returns immediately, and the card-routing caveat.
- [/supervise-issues tick runbook](supervise-tick-runbook.md) — **read first every tick**:
  cached `tickNNN/pull.sh` fast path, helper pipeline, delivery/turn discipline.
  - [False-positive shapes](supervise-tick-false-positives.md) — rows scan flags that aren't real, with disposition tokens.
  - [Scan blind spots](supervise-tick-blind-spots.md) — real stalls scan misreads, with detectors.
  - [Pipeline pitfalls](supervise-tick-pull-pitfalls.md) — pull/cache, state, CI-cell, GitHub-API and worktree-GC traps.
  - [Degraded ticks](supervise-tick-degraded.md) — probe first; credential-401 and `ncl`-congestion procedures.
  - [Scheduler: gated-series stall (closed tick 282)](scheduler-gated-series-stall.md) — false-gate stall cleared after the 10-14 06:06Z restart; the 11 per-issue i1xxxx gates were deleted (R10 cleanup, nanoclaw PR #1948) — never re-create them.
- [Self-modification: packages & MCP servers](self-modification.md) —
  install_packages vs workspace pnpm install; add_mcp_server + the vault
  credential-placeholder flow.
- [task-hygiene CLOSED rule drops post-merge checks](task-hygiene-closed-rule-post-merge.md) — a
  re-check whose PR merged is cancelled within the hour, even if its job is post-merge.
- [Placeholder one-shot tasks fire immediately](task-one-shot-placeholder.md) — create
  with the real prompt + future time in one call; read it back before quoting the id. Also: `ncl tasks update` is a write and never a probe; read a prompt back with `ncl tasks get` (`list` truncates it).
- [Coworker timer sessions are blind to the owner](coworker-timer-session-blind-to-owner.md) - a peer's `system:tasks:*` one-shot re-reports an old answer as new; check the chain record + GitHub, reply not-actionable, never re-dispatch (#10232 11-05)
- [Fixer reports drift to Main](fixer-fix-reports-drift-to-main.md) - slang-fixer `[Fix Report]`s often land on Main, not the handing-off triager; forward to the triager (cases 10-22→10-29)
- [Bot cannot close issues](bot-issue-close-hook-blocked.md) - a hook blocks the bot's issue close, even as text in a grep. The coworker replies "ready to close" and the maintainer closes it. Never put a close step in a dispatch (#12897 11-06).
- [Re-ask cap](reask-cap-park-after-final-ask.md) - operator re-ask series get one announced final ask, then park in supervisor-state.json; never re-ask indefinitely
- [Filing verified issues](filing-verified-issues-policy.md) - reproduced+deduped shader-slang bugs are filed without operator approval; external-repo filings, scope requests and fixer fan-out are asked/reported
- [Un-draft asks → weekly list](undraft-asks-replaced-by-weekly-list.md) - no per-PR 'may #N leave draft?' asks; maintainers flip drafts themselves; one weekly list (P0/P1 excepted)
- [Infra-alert dedupe](infra-alert-dedupe-across-sessions.md) - parallel Main sessions re-alert the same infra event (8× disk on 11-04); grep the dashboard's last rows first, post only new facts
- [Optional doc tweaks from Q&A triage](optional-doc-tweaks-from-qa-triage.md) - dispatch only a genuinely missing fact (one sentence, diffed against the whole page); never promise the reporter a doc PR (#12938 closed as redundant 11-04)
