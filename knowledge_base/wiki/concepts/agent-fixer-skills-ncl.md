---
title: "Skills, ncl CLI, and Slang-Specific Mechanics"
type: concept
group: agent-fixer-codex-skills
tags: [ncl, cli, slang-rhi, ci, zero-initialize, include-cycle, coworker-lifecycle]
source_count: 7
---

# Skills, ncl CLI, and Slang-Specific Mechanics

Operational notes for the `ncl` admin CLI (group lifecycle, task lifecycle, scope traps), slang-rhi CI behavior, and two Slang language/compiler mechanics that have caught fixers.

## TL;DR

- Use `mcp__nanoclaw__create_agent` to bootstrap a new agent group, never `ncl groups create` — the CLI path inserts only the `agent_groups` row, seeds no `container_configs`, and wires no reverse destination, so later `config update` fails and the group is a zombie until a host restart backfills it.
- Cross-group `--id` enforcement is per-command, not uniform: `groups config get/update --id <other>` is rejected at parse time for `group`-scoped callers, while `destinations add --target-id <other>` goes through approval normally. Assume nothing transfers between commands.
- An agent calling `ncl groups restart --id <other>` restarts its OWN session and silently drops `--id`/`--message`; approval replay preserves the `caller:'agent'` context, so operator approval does not fix it. Cross-group restart must be run by the operator from the host shell.
- Prefer plain `ncl groups restart --id <target>` over `--message`: `--message` writes `on_wake` to every running session in the group and can clobber an unrelated one. Re-hand resume context over normal a2a on the canonical thread instead.
- A one-shot scheduled task has two independently-live parts — trigger and payload. `cancel` retires only the trigger; the prompt survives and is immutable.
- Never re-arm a one-shot. Re-arming supplies the missing trigger to a live instruction whose side effects (a maintainer nudge, a comment, a push) are not idempotent.
- A spent one-shot is byte-identical in `ncl tasks list` to an orphan: `status: pending`, `process_after` in the past, `completed_runs: 0` forever — because `runs` increments on completion. A past `process_after` is necessary but never sufficient evidence that a task still needs to run.
- Never build a repair/watchdog mechanism whose predicate is "looks unfinished." Ask what a SUCCESSFUL run leaves behind on the row you inspect; if the answer is "nothing," that row cannot drive the repair.
- The run log (`ncl tasks append-log --id <t> --msg "…"`; the flag is `--msg`, not `--note`) is the only writable layer on a completed row and the thing a re-armed session reads. Never `delete` — it hard-deletes the series and its history, destroying that record.
- Distinguish `ncl`'s state-based refusals from its silent wrong-flag no-ops by running the same verb and flags against a live row as a positive control. Without the control, "no live task matched" is indistinguishable from a flag typo.
- Report what your action actually touched. "Cancelled it" removes the trigger, not the instruction — and a guard belongs in the re-arming mechanism, the layer that stays load-bearing.
- A guard in a mechanism that has never fired has never been tested. Verify the guard's predicate matches real data (a self-exclusion matching a substring that never appears in the actual id is dead code that looks like coverage).
- `shader-slang/slang-rhi` runs its full CI matrix, tests included, on draft PRs — tests run inline in the `build (<os>, <arch>, <compiler>, <config>)` jobs, so no ready-flip is needed to validate a fix. The CI-babysitter sweep skips drafts, so watch them yourself.
- `-zero-initialize` force-adds `IDefaultInitializable` to every non-core struct with no exclusion for compiler-synthesized decls, collapsing a captured lambda's closure constructors to zero-arg `$init()`. Exclude `SynthesizedModifier` structs at the forcing site; keep it separate from the long-term IR-pass redesign.
- When a new public header under `include/` is included by `slang.h` and also needs its types, put `#include "slang.h"` OUTSIDE the header's own `#ifndef` guard, and use `#ifndef` rather than `#pragma once`. Public `slang-*.h` headers auto-install via the CMake glob; verify with `g++ -fsyntax-only -Iinclude` on one-line TUs.
- Never stage the bundled conservative approval policy into a per-PR workspace `policy/` dir — it shadows the mounted relaxed policy and flips clauses to FAIL.

## ncl Group Lifecycle: Zombie Groups and Scope Enforcement

`ncl groups create` is incomplete for bootstrapping a new agent group ([ncl groups-create produces zombie groups; cross-group --id is parse-time-blocked](../learnings/1779254262878-ncl-groups-create-produces-zombie-groups-cross-gro.md)). It only inserts the `agent_groups` row. It does NOT:
- Seed a default `container_configs` row → subsequent `ncl groups config update --id <new>` fails with `"No container config for group: <id>"`.
- Establish a reverse destination from the new group back to the creator.

Use `mcp__nanoclaw__create_agent` (admin-only) for new agents instead. The MCP path bundles seeding + bidirectional wiring. An `ncl`-created group may eventually self-rescue via `src/backfill-container-configs.ts` on host restart, but cold-start latency in the degraded state can be ~11 hours vs. ~34 s warm round-trip on a properly wired group.

**Cross-group `--id` scope enforcement is inconsistent across commands.** For non-admin coworkers (scope = `group`), `ncl groups config get/update --id <other>` is rejected parse-time (before the approval flow); `ncl destinations add --target-id <other>` goes for approval normally (because `--target-id` is a separate field). Practical implication: a coworker can create + forward-wire a child group but cannot configure it — admin must drive `config update --id <child>` from their scope. Key source refs: `src/cli/resources/groups.ts:60`, `src/cli/crud.ts:253-257`, `src/db/container-configs.ts`.

**An agent-initiated `ncl groups restart --id <other-group>` CANNOT restart another group.** The restart handler branches on caller: when `ctx.caller === 'agent'` it calls `killContainer(ctx.sessionId, …)` — killing the CALLER's OWN session and IGNORING `--id`/`--message`; only a HOST caller (operator in the host shell) reaches the group-wide `restartAgentGroupContainers`. Worse, approval replay preserves the original `caller:'agent'` context, so an agent-minted `restart --id <other> --message "…"` that the operator approves still misfires onto the requesting agent's own session with `--id`/`--message` dropped — which explains prior "restart requested but nothing happened" symptoms (observed for slang-fixer thrash-recovery on #12070/#12071/#12073). `mcp__nanoclaw__request_restart` also only restarts the CALLER's own container. Remedy for a cross-group restart: escalate to the operator to run from the HOST shell `ncl groups restart --id <target> [--message "<resume>"]` — prefer plain (no `--message`, kills only running containers, each respawns on next inbound) over `--message` (writes on_wake to every running session, risks clobbering an unrelated one); re-hand the resume memo via normal a2a on the canonical thread instead ([agent ncl restart can't target another group](../learnings/1783913779722-agent-ncl-restart-can-t-target-another-group.md)).

## ncl Task Lifecycle: Cancelling Retires the Trigger, Not the Payload

A one-shot scheduled task has **two independently-live parts — the trigger and the payload — and `cancel` reaches only the first** ([Cancelling a one-shot scheduled task removes the trigger, not the payload — and a spent row is immutable](../learnings/1786073581086-cancelling-a-one-shot-scheduled-task-removes-the-t.md)). The prompt survives cancellation, and on a spent row it is **immutable**: `ncl tasks update --id <spent> --prompt '<defused>'` refuses with `no live task matched: <spent>`, while a fabricated id returns the distinct `task not found` — two error strings proving the row still *exists* and is merely not *live*. The refusal is state-based, not a wrong-flag error, and that distinction must be earned with a positive control: run the same verb and flags against a *live* row (a no-op prompt rewrite returned `{"touched":1,"fields":["prompt"]}`) so the failure cannot be confused with `ncl`'s known silent wrong-flag no-op.

**A spent one-shot is byte-identical to an orphaned one in `ncl tasks list`.** It stays `status: pending`, with `process_after` in the past and `completed_runs: 0`, *forever* — because `runs` increments on **completion**, so a successful fire leaves nothing on the row it inspected. A past `process_after` is therefore necessary but not sufficient evidence that a task still needs to run; consult the run log, or resolve the session, before concluding anything. The operational consequence is absolute: **never re-arm a one-shot.** Re-arming supplies the one missing part — the trigger — to a live instruction whose side effects (a maintainer nudge, a comment, a push) are not idempotent, which is how a watchdog keyed on "looks unfinished" becomes the live path to a duplicate action someone explicitly forbade.

Two corollaries follow. First, the only writable layer on a completed row is the run log (`ncl tasks append-log --id <t> --msg "…"` — the flag is `--msg`; `--note` is rejected), and it is what a re-armed session actually reads, so a defusing note goes there and never through `delete`, which hard-deletes the series *and its history* along with the very record that says "already fired." Second, put the guard in the **re-arming mechanism**, not the task — and remember that a guard which has never had to fire has never been tested: a real watchdog's self-exclusion matched the substring `scheduler-watchdog` while the actual series ids were `task-<digits>-<suffix>`, so it was dead across all 126 runs and read as coverage the whole time.

## slang-rhi CI Runs on Draft PRs

`shader-slang/slang-rhi` runs its full CI build matrix on **draft PRs** ([slang-rhi runs full CI matrix (incl. tests) on draft PRs](../learnings/1781175866294-slang-rhi-runs-full-ci-matrix-incl-tests-on-draft-.md)). Tests execute inline within the `build` matrix jobs (via `./slang-rhi-tests -check-devices`) — there is no separate test job. This matters because headless containers cannot build `slang-rhi-tests` locally (GLFW needs X11/RandR; `enum-strings.h` is build-generated), so CI is the only arbiter for runner-specific behavior (e.g. macOS Metal-timer). When validating a slang-rhi fix, watch the draft PR's `build (<os>, <arch>, <compiler>, <config>)` matrix job — no ready-flip required. Caveat: the CI-babysitter sweep only covers non-draft PRs; it will not auto-report a draft's CI result.

## -zero-initialize and Synthesized Lambda Closures

The `-zero-initialize` flag's forcing site is `SemanticsDeclBasesVisitor::visitStructDecl` at `source/slang/slang-check-decl.cpp:11424-11441` ([slang -zero-initialize forces IDefaultInitializable on ALL non-core structs (incl. synthesized closures) at slang-check-decl.cpp:11424](../learnings/1781240588042-slang-zero-initialize-forces-idefaultinitializable.md)). Under `getBoolOption(ZeroInitialize) && !isFromCoreModule(decl)` it force-adds an `IDefaultInitializable` inheritance to ANY non-core struct — with NO exclusion for synthesized/compiler-generated decls. A captured lambda is lowered to a synthesized `LambdaDecl` closure struct (marked `SynthesizedModifier`), and this forcing collapses its constructor set to a zero-arg `$init()`, causing `error E39999: too many arguments to call` when captured values are passed. Fix: exclude structs carrying `SynthesizedModifier` (or narrowly `!as<LambdaDecl>(decl)`) at the forcing site. Context: slang#11573 "Reimplement -zero-initialize as an IR pass" is the long-term redesign; keep per-issue fixes scoped to the targeted exclusion, not conflated with the IR-pass redesign.

## Slang Public-Header Include Cycles

When adding a new public header under `include/` that is `#include`d by `slang.h` and also needs `slang.h`'s types, a mutual-include cycle results ([Slang public-header include cycle: include slang.h OUTSIDE your own guard](../learnings/1782759769387-slang-public-header-include-cycle-include-slang-h-.md)). If the new header uses `#pragma once` with `#include "slang.h"` inside its guard, including the new header first fails: the nested `slang.h` hits its own `#include "newheader.h"` line, the guard suppresses re-entry, and the prototypes are never declared before `slang.h`'s wrappers need them.

Fix: put `#include "slang.h"` **before** the new header's own `#ifndef` guard. Then on a newheader-first include, the nested `slang.h` re-enters the new header at slang.h's include line (where `NEWHEADER_H` isn't defined yet) and declares the prototypes ahead of the wrappers; `slang.h`'s own `#ifndef SLANG_H` breaks the recursion. Match the `#ifndef` guard convention (not `#pragma once`). Public headers auto-install via the `include/slang*.h` glob in `source/slang/CMakeLists.txt` — a new `slang-*.h` needs no CMake edit. Verify cheaply with `g++ -std=c++17 -fsyntax-only -Iinclude` on 1-line TUs per header.


## Recent operational learnings (incremental fold 2026-07-17)

**[approver/critique-mustfix] Do not stage the bundled v0-shadow policy into the workspace policy/ dir — it shadows the mounted v0-shadow-relaxed and flips clauses to FAIL** — **Symptom:** On slang#12118 I copied the bundled `APPROVAL_POLICY.json` (`v0-shadow`, the conservative default next to `eval-clauses.py`) into the per-PR workspace `work/<pr>/policy/` during staging. [[approver/critique-mustfix] Do not stage the bundled v0-shadow policy into the workspace policy/ dir — it shadows the mounted v0-shadow-relaxed and flips clauses to FAIL](../learnings/1784117125434-approver-critique-mustfix-do-not-stage-the-bundled.md)

---
**Source learnings (7):**
- [ncl groups-create produces zombie groups; cross-group --id is parse-time-blocked](../learnings/1779254262878-ncl-groups-create-produces-zombie-groups-cross-gro.md)
- [agent ncl restart can't target another group](../learnings/1783913779722-agent-ncl-restart-can-t-target-another-group.md)
- [slang-rhi runs full CI matrix (incl. tests) on draft PRs](../learnings/1781175866294-slang-rhi-runs-full-ci-matrix-incl-tests-on-draft-.md)
- [slang -zero-initialize forces IDefaultInitializable on synthesized closures](../learnings/1781240588042-slang-zero-initialize-forces-idefaultinitializable.md)
- [Slang public-header include cycle: include slang.h outside your own guard](../learnings/1782759769387-slang-public-header-include-cycle-include-slang-h-.md)

- [[approver/critique-mustfix] Do not stage the bundled v0-shadow policy into the workspace policy/ dir — it shadows the mounted v0-shadow-relaxed and flips clauses to FAIL](../learnings/1784117125434-approver-critique-mustfix-do-not-stage-the-bundled.md)
- [Cancelling a one-shot scheduled task retires the trigger but leaves the payload live and immutable; a spent one-shot is indistinguishable from an orphan in `ncl tasks list`, so never re-arm one.](../learnings/1786073581086-cancelling-a-one-shot-scheduled-task-removes-the-t.md)
_Catalog: [[wiki/index.md]]_
