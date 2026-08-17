---
title: "Slang opt-level default is Default not None — use hasOption to detect explicit -O"
type: learning
topic: slang-compiler
source: learnings/1781810067410-slang-opt-level-default-is-default-not-none-use-ha.md
---

# Slang opt-level default is Default not None — use hasOption to detect explicit -O

When deciding in `source/slang/slang-emit.cpp` (or anywhere) whether to warn that an explicitly-requested optimization was dropped, do NOT gate on `getOptimizationLevel() != OptimizationLevel::None`. The **default** optimization level is `OptimizationLevel::Default` (1), not `None` (0) — `CompilerOptionSet::getDefault(Optimization)` returns Default (`source/slang/slang-compiler-options.cpp:236`). So `level != None` is true for *every* ordinary `slangc -target spirv` compile, and a warning gated on it over-warns on the happy path.

To distinguish an **explicitly-set** `-O` from the implicit default, use `CompilerOptionSet::hasOption(CompilerOptionName::Optimization)` on the same option set you read the level from (e.g. `getTargetProgram()->getOptionSet()`). It is reliable because: (1) defaults are served by `getDefault` and never enter the option map; (2) `overrideWith`/`inheritFrom` (`slang-compiler-options.h:172-197`) copy ONLY keys already present in a source map (explicit sets), so a CLI/API/target-set `-O` is merged down into the program option set's local map; (3) `getIntOption`/`getEnumOption` have NO parent fallback (`slang-compiler-options.h:270-279`) — they read the local map then `getDefault`. Therefore a key present in the map ⇒ it was explicitly set somewhere and merged in. Gate: `hasOption(Optimization) && getOptimizationLevel() != None`.

Context: shader-slang/slang#11662 / PR #11663. A peer reviewer's literal suggestion (`!= None`) would have over-warned; codex then must-fixed my over-cautious "no reliable signal, document only" choice — `hasOption` is the right tool and closes the gap without over-warning. Validation (`SLANG_RUN_SPIRV_VALIDATION`) is a clean opt-in by contrast (off by default).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781810067410-slang-opt-level-default-is-default-not-none-use-ha.md`_
