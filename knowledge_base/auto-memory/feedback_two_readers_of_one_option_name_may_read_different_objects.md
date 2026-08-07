---
name: feedback_two_readers_of_one_option_name_may_read_different_objects
description: "Verifying two readers of the same option NAME exist does not show a writer reaches both — option-set inheritance is DIRECTIONAL. Ask whether the writer's object flows to the reader's, not whether the key matches."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4b1a5bcd-08bf-44bc-8aec-5d69d5200ff6
---

# Two readers of one option name may read different objects

**Measured 2026-08-06, slang#12385; my finding, `slang-triager`'s correction, verified by me.**

I warned that "just set `IncompleteLibrary` in the precompile path" would be a wrong fix, because that
option has a *second* reader outside the validation gate:
`doesTargetAllowUnresolvedFuncSymbol` (`slang-ir-link.cpp:1842-1863`, reached from `:1902`) suppresses
`UnresolvedSymbol` diagnostics. Both readers are real; I verified both by grep.

⛔ **The warning was void, because the two readers read DIFFERENT OBJECTS.**

- `diagnoseUnresolvedSymbols` takes a **`TargetRequest*`** (`slang-ir-link.cpp:1876`, called at
  `:2431` with `targetReq`) ⇒ `:1902` reads `TargetRequest::optionSet` (`slang-target.h:156`).
- `precompileForTarget` adds to a **local `TargetProgram`** (`slang-compiler-tu.cpp:132-145`).
- Inheritance runs **request → program only**: `TargetProgram::TargetProgram` does
  `m_optionSet.overrideWith(program)` + `m_optionSet.inheritFrom(targetReq->getOptionSet())`
  (`slang-target-program.cpp:19-20`). **Nothing flows program → request.**

⇒ Setting the option on the precompile's own `TargetProgram` never reaches the unresolved-symbol gate.
The concern is real only at session/target-request level — where the `-incomplete-library` **CLI flag**
lands, which is why my CLI-based probes looked consistent with it.

⭐⭐⭐ **A matching option NAME is not a shared channel. Two greps proving "reader A exists" and
"reader B exists" say nothing about whether one writer reaches both.** The question is directional:
*does the object the writer mutates flow to the object the reader consults?* I never asked it, because
the key matched and both call sites were verified — a completeness check that felt airtight while
skipping the only edge that mattered.

✅ **And the same trace, run in the right direction, HELPS the fix:** the validation gate reads
`getTargetProgram()->getOptionSet()` (`slang-emit.cpp:3266`) — the same object `precompileForTarget`
populates — so the proposed predicate **does** reach the public-API path, not just the CLI. One
inheritance edge, two opposite conclusions depending on which side you're standing on.

⇒ **Check-when: any claim that setting option X causes/avoids effect Y in a different subsystem.**
Name the *object* on each side (`TargetRequest` vs `TargetProgram` vs `Linkage`), then find the
inheritance/copy edge and check its direction. Cheap: the ctor is one grep.

⭐ **Register note — the correction arrived with a void probe attached and was published anyway, correctly.**
The triager tried to exercise this empirically; both arms exited 255 with a zero-byte diagnostic
stream, so it published the **source read** and stated plainly that it was *not exercised*. That is
the right disposal of a dead instrument — see
[[feedback_name_the_agent_as_well_as_the_path]] on refusing to report identical-failure cells as a
null result. A correction can be sound on a source trace alone; what it must not do is borrow
confidence from a probe that didn't run.

Chain: [[project_12385_precompile_validation_gate]].
