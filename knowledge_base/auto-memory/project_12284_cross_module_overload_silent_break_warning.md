---
name: project-12284-cross-module-overload-silent-break-warning
description: "slang#12284 — proposed warning for cross-module overload silently overriding a local candidate; TRIAGED+PARKED"
metadata: 
  node_type: memory
  type: project
  originSessionId: 73c43656-0b8f-4a5b-b4d5-1c374eb48e35
---

# slang#12284 — cross-module overload silent-breakage warning (TRIAGED + PARKED)

**Repo:** shader-slang/slang · **Author:** skiminki-nv (MEMBER, self-filed, "Dev Opened", `Language-Maturity` family) · **HEAD:** `7c58a326b` · thread `gh-issue-shader-slang/slang-12284`

**Request:** New WARNING diagnostic. When a call needs implicit conversion and an *imported* module later adds a better-matching (e.g. exact) exported overload, overload resolution silently rebinds the call to the import — changing semantics with no diagnostic. Reporter's spec: warn when (1) candidates span >1 module AND (2) winner's module != call-site module. Reporter notes stdlib growth (`core.meta.slang`/`hlsl.meta.slang`) is technically breaking under this rule too.

**Classification:** feature-request / enhancement · medium · P2 · frontend (semantic checker — overload resolution). No dup.

**Feasibility (VERIFIED in source):** Implementable. Central constraint — `AddOverloadCandidate`→`AddOverloadCandidateInner` (slang-check-overload.cpp:2525/2442) **eagerly prunes** the beaten local candidate (`fastRemoveAt` :2465) BEFORE the winner is finalized at `CompleteOverloadCandidate` (:3744). ⟹ a naive "compare modules at decision point" hook can't see the overridden local loser; must record contributing-candidate modules AT the choke-point, before pruning. Mandatory `isFromCoreModule`/`FromCoreModuleModifier` carve-out or it fires on nearly every implicit-conversion stdlib call.
- Files: slang-check-overload.cpp:2442/2525/3744; slang-check-impl.h:384/861; slang-syntax.cpp:1246 (`getModuleDecl`); slang-diagnostics.lua (~3959). Test vehicle: `DIAGNOSTIC_TEST:SIMPLE`, 2-file module setup (patterns: tests/diagnostics/overload-ambiguous.slang).
- Recommended approach: **A** — track contributing modules through the choke-point + stdlib suppression. (B = narrower "same-module candidate overridden"; C = opt-in/off-by-default.)

**State:** TRIAGED + PARKED, no fixer. Verdict 5-bullet POSTED on issue (comment 5129359865, 2026-07-30T09:59:27Z) with two open **language-policy** design questions surfaced: (1) trigger semantics A (">1 module among candidates") vs B ("a same-module/call-site candidate was silently overridden by import"); (2) on-by-default vs opt-in flag/pragma (stdlib-noise concern). Matches skiminki-nv self-filed Language-Maturity park precedent (siblings [[project-12266-defer-bare-decl-scope-leak-crash]] etc.).

**RESUME trigger:** explicit "make a PR" / linked PR / substantive design decision from skiminki or a maintainer → dispatch slang-fixer with the chosen shape (A vs B, default-on vs opt-in). Blocker: awaiting reporter's steer on the two design questions.
