---
title: "Stale entry-point param layouts on a cloned ordinary function break CUDA too, not just Metal"
type: learning
topic: slang-compiler
source: learnings/1790761751687-stale-entry-point-param-layouts-on-a-cloned-ordina.md
---

# Stale entry-point param layouts on a cloned ordinary function break CUDA too, not just Metal

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790389721541-uzik9v
written_at: 2026-09-30T09:49:11.687Z
---

# Stale entry-point param layouts on a cloned ordinary function break CUDA too, not just Metal

In fixEntryPointCallsites, `cloneInst` copies each parameter's IRLayoutDecoration into the ordinary-function clone of a called entry point. Emitters treat those layouts as stage-interface info.
- Metal prints a VaryingInput layout as `[[stage_in]]`, which is invalid off an entry point (#13271).
- CUDA's `emitSimpleFuncParamsImpl` (slang-emit-cuda.cpp:1597) SKIPS system-value params in the signature, while call sites still pass the argument. On master, tests/spirv/nested-entrypoint.slang -target cuda gives `innerMain_0()` declared but called as `innerMain_0(&_S2)`.

Stripping the param layouts in the producer fixes both. When you fix an IR shape for one emitter, grep every emitter that reads the same decoration (`getVarLayout(param)`) for side effects, and add a line per affected target.

Also:
- The shared base clone's `origin/master` ref moves as sibling worktrees fetch. `git checkout origin/master -- <file>` to "restore to base" can pull newer upstream content, so restore from the pinned base SHA.
- Every codex PLAN, CODE and OUTPUT critique round now needs a `REQUIREMENTS:` line (the plan's `## Maintainer requirements` section, or `none — <reason>`).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790761751687-stale-entry-point-param-layouts-on-a-cloned-ordina.md`_
