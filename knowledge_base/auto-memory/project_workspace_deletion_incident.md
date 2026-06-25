---
name: Workspace-deletion incident (open) — slang-fixer dev workspace wiped mid-chain
description: 2026-06-24 host-side group-lifecycle process deleted the slang-fixer dev workspace mid-chain (likely dev↔prod folder-name collision); fixer is a fleet outage; source needs host logs; may recur and hit prod
type: project
originSessionId: 2fa53995-46b6-441a-92d7-5c95fde29125
---
A targeted, unexplained deletion of the `slang-fixer` dev workspace mid-chain. Source localized to a host-side process; exact culprit NOT yet named (needs host logs).

**When:** `2026-06-24 14:55:55 UTC` (precise — parent-dir mtime bumps when a child is unlinked).

**What:** the entire dev `slang-fixer` workspace (`lego-groups/slang-fixer`, agent group `ag-1780667166439-vmjrwe`, name `slang-fixer` — the typed coworker Main dispatches slang fixes to): both git clones (`slang-real`, `slang`), `wt-slang-11479`, plus `memory/`, `conversations/`, `active-work/`, `queued-inbox/`, `patches/`, `reports/`. ~16G (volume 13G→29G free).

**Confirmed by elimination (orchestrator, read-only) — what it was NOT:**
- NOT an agent action — zero session activity 14:00–15:59 across all groups.
- NOT a scheduled/cron task — `list_tasks` returns none.
- NOT self-mod/approval — no approval recorded.
- NOT `ncl groups delete` — group row still registered.
- NOT a disk/size sweep — only `slang-fixer` was hit; perfhound (11G), reviewer, neuralgraphics, ALL of prod-groups untouched (mtimes days old). Also NOT Main (read-only mount, cannot write) and NOT the operator running Main's proposed `rm` (those 3 prod cleanup worktrees are intact).

**Leading hypothesis:** a host-side, group-scoped lifecycle process (kill-and-rescaffold / rebuild / orphan-cleanup) keyed on group/folder, that wiped the dir and errored before rescaffolding (or hasn't, since no wake occurred). Because BOTH prod and lego trees contain a `slang-fixer` folder, a **cross-instance path/name collision** (a prod-side op resolving "slang-fixer" to the lego path, or vice-versa) is the prime suspect — fits the documented dev↔prod collision pattern.

**Operational impact:** `slang-fixer` is a **fleet outage** — wiped 14:55, still not rescaffolded 10+ min later; can't build until its folder re-scaffolds + re-clones (cold restart, loses accumulated memory/history/worktrees). #11730 dispatched to it at ~14:17 is **stalled at the implementer**. `wt-slang-11730` never checked out → no 11730-specific work lost. GitHub footprint (verdict comment + `reproduced` + Type=Bug) survives — lives on GitHub, not the workspace.

**Recovery caution — do NOT blind-restart:** a `ncl groups restart` of `slang-fixer` from the dev side could resolve the shared folder name to the PROD path and wipe the prod slang-fixer (with active `wt-slang-11538`). Prefer the **natural wake**: the triager's re-sent handoff spawns a fresh container → group-init rescaffolds the missing workspace → processes the handoff (normal spawn path, distinct from the buggy lifecycle op). If it doesn't self-recover, escalate recovery to the operator — don't force a restart until the lifecycle path is pinned.

**To pin the culprit (needs host shell — unreachable from any ro container):** grep `logs/nanoclaw.log` + `logs/nanoclaw.error.log` around `14:55:5x` for group id `ag-1780667166439-vmjrwe`, folder `slang-fixer`, and `killContainer` / `restart` / `rebuild` / `rescaffold` / `orphan` / `group-init` / `rm`.

**Status (updated 2026-06-24 ~17:55 UTC):** DISK THREAD RESOLVED, but the 14:55 wipe remains separate & open. The 17:50 prod cleanup (~18 stale worktrees, incl. the 3 I'd flagged) was the **§8 worktree-GC automation** — `slang-coworkers/nanoclaw` PR #686 "fix(supervise): §8 worktree GC reaps dead-session orphans", merged 17:40:36Z — NOT a manual operator rm. PR #686 fixes the recurring /ephemeral disk-full at root: reaps dead-session terminal-PR (MERGED/CLOSED) orphans by `gh pr list --head` state (never git-prunable — that flag is a wrong-namespace artifact from the container path), wakes dead-session fixers, and save-then-removes (`wip/reap/<branch>` pushed first → lossless; recover via `git worktree add wt-<slug> wip/reap/<branch>`). My container refresh at ~17:53 was the same PR #686 rollout. Disk durably recovered to ~32-37G; disk-full recurrence now prevented at source.

**REFUTES the earlier "buggy GC caused 14:55" hypothesis:** PR #686 / the §8 GC reaps *individual worktrees*, never whole group dirs. The 14:55 whole-group wipe of `lego-groups/slang-fixer` (clones + memory + active-work + queued-inbox + everything) is a DIFFERENT, still-separate, still-unexplained mechanism. Dev fixer still down; **host-log culprit-naming around `14:55:5x` remains the pending operator action.** Prod #11730 build progressing on the freed disk; dev fixer idle-held under the dedup gate.

**Durable lesson (cause-agnostic):** A peer-wire handoff can be silently lost if the downstream's queued-inbox is wiped (workspace deletion/restart/rescaffold). Don't assume delivery — verify the downstream acked/started; recover by re-sending from the upstream tier that holds the memo (triage memo / PR / GitHub comment survive a workspace wipe; the agent's local inbox does not). And: shared folder names across dev/prod instances are a deletion-collision hazard — never blind-restart a group whose folder name is non-unique across instances.
