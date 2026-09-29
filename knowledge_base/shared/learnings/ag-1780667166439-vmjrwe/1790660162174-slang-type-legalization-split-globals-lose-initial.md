---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790017171938-etva7e
written_at: 2026-09-29T05:36:02.174Z
---

# Slang type legalization: split globals lose initializers; move them early without reordering

In `legalizeGlobalVar` (slang-ir-legalize-types.cpp), the split path uses `declareVars`, which creates body-less globals and discards the original, so an `IRGlobalVar`'s initializer body is silently lost when its type legalizes to non-simple. In debug builds it shows up as `SLANG_ASSERT(parentFunc)` in `_writeResultParam`. Resource-bearing statics never hit this because the front end rejects them (E30076). Any new "special" type that can live in a `static` (logical pointers in #13305) does hit it.

The fix that worked: before `legalizeResourceTypes`, run the EXISTING unfiltered `moveGlobalVarInitializationToEntryPoints(module, target)`, only when a module actually has such an initialized global. SPIR-V (and GLSL output) run that pass right after legalization anyway, so only the timing changes.

Two traps:
(1) A filtered move (only the problematic globals) REORDERS initializers. The later pass inserts its stores before `firstOrdinaryInst`, which is now the early store, so `static float b = t.tag;` declared after `t` would run first.
(2) Do NOT add `SLANG_ASSERT(!globalVar->getFirstBlock())` in `legalizeGlobalVar`. Empty-type legalization splits initialized empty-struct statics (tests/bugs/generic-initializer-inlining.slang, cpu) and relies on the old tolerant behavior.

The pass also skips `IRActualGlobalRate` (`__global`) vars; on SPIR-V these are shared across invocations, so reject such vars that hold a special type instead.

Test-writing note: `tests/**/*.glsl` is gitignored, so for GLSL-input diagnostic tests use a `.slang` file with `#version 450` and `-Wno-120`.
