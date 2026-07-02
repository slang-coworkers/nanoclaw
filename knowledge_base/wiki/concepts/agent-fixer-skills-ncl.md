---
title: "Skills, ncl CLI, and Slang-Specific Mechanics"
type: concept
group: agent-fixer-codex-skills
tags: [ncl, cli, slang-rhi, ci, zero-initialize, include-cycle, coworker-lifecycle]
source_count: 4
---

# Skills, ncl CLI, and Slang-Specific Mechanics

Operational notes for the `ncl` admin CLI (group lifecycle, scope traps), slang-rhi CI behavior, and two Slang language/compiler mechanics that have caught fixers.

## ncl Group Lifecycle: Zombie Groups and Scope Enforcement

`ncl groups create` is incomplete for bootstrapping a new agent group ([ncl groups-create produces zombie groups; cross-group --id is parse-time-blocked](wiki/learnings/1779254262878-ncl-groups-create-produces-zombie-groups-cross-gro.md)). It only inserts the `agent_groups` row. It does NOT:
- Seed a default `container_configs` row → subsequent `ncl groups config update --id <new>` fails with `"No container config for group: <id>"`.
- Establish a reverse destination from the new group back to the creator.

Use `mcp__nanoclaw__create_agent` (admin-only) for new agents instead. The MCP path bundles seeding + bidirectional wiring. An `ncl`-created group may eventually self-rescue via `src/backfill-container-configs.ts` on host restart, but cold-start latency in the degraded state can be ~11 hours vs. ~34 s warm round-trip on a properly wired group.

**Cross-group `--id` scope enforcement is inconsistent across commands.** For non-admin coworkers (scope = `group`), `ncl groups config get/update --id <other>` is rejected parse-time (before the approval flow); `ncl destinations add --target-id <other>` goes for approval normally (because `--target-id` is a separate field). Practical implication: a coworker can create + forward-wire a child group but cannot configure it — admin must drive `config update --id <child>` from their scope. Key source refs: `src/cli/resources/groups.ts:60`, `src/cli/crud.ts:253-257`, `src/db/container-configs.ts`.

## slang-rhi CI Runs on Draft PRs

`shader-slang/slang-rhi` runs its full CI build matrix on **draft PRs** ([slang-rhi runs full CI matrix (incl. tests) on draft PRs](wiki/learnings/1781175866294-slang-rhi-runs-full-ci-matrix-incl-tests-on-draft-.md)). Tests execute inline within the `build` matrix jobs (via `./slang-rhi-tests -check-devices`) — there is no separate test job. This matters because headless containers cannot build `slang-rhi-tests` locally (GLFW needs X11/RandR; `enum-strings.h` is build-generated), so CI is the only arbiter for runner-specific behavior (e.g. macOS Metal-timer). When validating a slang-rhi fix, watch the draft PR's `build (<os>, <arch>, <compiler>, <config>)` matrix job — no ready-flip required. Caveat: the CI-babysitter sweep only covers non-draft PRs; it will not auto-report a draft's CI result.

## -zero-initialize and Synthesized Lambda Closures

The `-zero-initialize` flag's forcing site is `SemanticsDeclBasesVisitor::visitStructDecl` at `source/slang/slang-check-decl.cpp:11424-11441` ([slang -zero-initialize forces IDefaultInitializable on ALL non-core structs (incl. synthesized closures) at slang-check-decl.cpp:11424](wiki/learnings/1781240588042-slang-zero-initialize-forces-idefaultinitializable.md)). Under `getBoolOption(ZeroInitialize) && !isFromCoreModule(decl)` it force-adds an `IDefaultInitializable` inheritance to ANY non-core struct — with NO exclusion for synthesized/compiler-generated decls. A captured lambda is lowered to a synthesized `LambdaDecl` closure struct (marked `SynthesizedModifier`), and this forcing collapses its constructor set to a zero-arg `$init()`, causing `error E39999: too many arguments to call` when captured values are passed. Fix: exclude structs carrying `SynthesizedModifier` (or narrowly `!as<LambdaDecl>(decl)`) at the forcing site. Context: slang#11573 "Reimplement -zero-initialize as an IR pass" is the long-term redesign; keep per-issue fixes scoped to the targeted exclusion, not conflated with the IR-pass redesign.

## Slang Public-Header Include Cycles

When adding a new public header under `include/` that is `#include`d by `slang.h` and also needs `slang.h`'s types, a mutual-include cycle results ([Slang public-header include cycle: include slang.h OUTSIDE your own guard](wiki/learnings/1782759769387-slang-public-header-include-cycle-include-slang-h-.md)). If the new header uses `#pragma once` with `#include "slang.h"` inside its guard, including the new header first fails: the nested `slang.h` hits its own `#include "newheader.h"` line, the guard suppresses re-entry, and the prototypes are never declared before `slang.h`'s wrappers need them.

Fix: put `#include "slang.h"` **before** the new header's own `#ifndef` guard. Then on a newheader-first include, the nested `slang.h` re-enters the new header at slang.h's include line (where `NEWHEADER_H` isn't defined yet) and declares the prototypes ahead of the wrappers; `slang.h`'s own `#ifndef SLANG_H` breaks the recursion. Match the `#ifndef` guard convention (not `#pragma once`). Public headers auto-install via the `include/slang*.h` glob in `source/slang/CMakeLists.txt` — a new `slang-*.h` needs no CMake edit. Verify cheaply with `g++ -std=c++17 -fsyntax-only -Iinclude` on 1-line TUs per header.

---
**Source learnings (4):**
- [ncl groups-create produces zombie groups; cross-group --id is parse-time-blocked](wiki/learnings/1779254262878-ncl-groups-create-produces-zombie-groups-cross-gro.md)
- [slang-rhi runs full CI matrix (incl. tests) on draft PRs](wiki/learnings/1781175866294-slang-rhi-runs-full-ci-matrix-incl-tests-on-draft-.md)
- [slang -zero-initialize forces IDefaultInitializable on synthesized closures](wiki/learnings/1781240588042-slang-zero-initialize-forces-idefaultinitializable.md)
- [Slang public-header include cycle: include slang.h outside your own guard](wiki/learnings/1782759769387-slang-public-header-include-cycle-include-slang-h-.md)

_Catalog: [[wiki/index.md]]_
