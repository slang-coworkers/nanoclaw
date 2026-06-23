---
name: Auto-route hook can re-trigger parked/held chains
description: A fixer-side auto-route hook nudges the fixer to implement a triaged approach even when the orchestrator has parked the chain on maintainer intent — defend parks; treat hook-driven activity on a held chain as illegitimate
type: project
originSessionId: cf74fc54-ce4e-4cfa-bb1d-56c834cf2f3c
---
Fixer containers run an auto-route hook that can independently nudge the fixer to implement a triaged approach even when the orchestrator has explicitly PARKED the chain awaiting maintainer intent.

Observed 2026-06-22 on shader-slang/slang#11682 (`slangc -g0` includes SPIR-V debug info — a doc-vs-behavior fork: Approach A = correct help text, Approach B = gate OpName/OpSource on `DebugInfoLevel::None`; B flagged as a maintainer design call, fix HELD). A context-inheriting background fork the triager spawned auto-ran the whole workflow (posted a duplicate triage comment + dispatched a memo to slang-fixer) before the hold landed; separately, an auto-route hook nudged slang-fixer to implement Approach A despite the park. The fixer correctly deferred to the triager's explicit stand-down and stayed idle (verified clean: no edits/commit/branch/PR; worktree+sentinel cleaned).

**Why:** the hook fires on its own schedule and does not see the orchestrator's hold as a hard gate — only an explicit stand-down living in the fixer's context suppresses it, and a fresh fire risks losing that context.

**How to apply:** The ONLY legitimate re-open of a parked chain is the path the orchestrator defined — for GitHub chains: a maintainer reply on the issue → webhook → orchestrator re-routes. If fixer activity, a worktree, or a (draft) PR appears on a chain you parked WITHOUT that trigger, treat it as a hook/fork re-trigger: stand it down, don't treat it as a legitimate dispatch. Blast radius is bounded (drafts-only guardrail + merge gate), but a stray draft PR re-promises work on a held issue and undermines the maintainer-intent park. Companion: `project_fork_reentrancy_phantom_codriver` (context-inheriting forks re-running workflows) — same failure family, different mechanism.
