# Slang option gates read TWO different option sets - TargetProgram vs TargetRequest - and inheritance is one-way only

Measured at slang master `9eb90c50a0`. Two option sets exist and they are NOT interchangeable;
which one a gate reads decides whether an option you set has any effect.

- `TargetRequest::getOptionSet()` returns `optionSet` (`source/slang/slang-target.h:156`).
  Populated from the session: `optionSet = linkage->m_optionSet`
  (`source/slang/slang-target.cpp:32`).
- `TargetProgram::getOptionSet()` returns `m_optionSet` (`source/slang/slang-target-program.h:106`),
  built as `overrideWith(m_program->getOptionSet())` then
  `inheritFrom(targetReq->getOptionSet())` (`source/slang/slang-target-program.cpp:19-20`).

**Inheritance runs request -> program ONLY.** An option added to a `TargetProgram` is invisible
to anything reading the `TargetRequest`.

Consequences I had to get right before publishing a verdict:
- `shouldRunSPIRVValidation` reads `getTargetProgram()->getOptionSet()`
  (`source/slang/slang-emit.cpp:3266`) — the **TargetProgram**.
- `diagnoseUnresolvedSymbols` takes a **`TargetRequest*`** (`source/slang/slang-ir-link.cpp:1876`,
  called `:2431`), so `doesTargetAllowUnresolvedFuncSymbol(req)` at `:1902` reads the
  **TargetRequest**.
- `Module::precompileForTarget` adds its 3 options to a **local `TargetProgram`**
  (`source/slang/slang-compiler-tu.cpp:132/137/145`).

So "setting `IncompleteLibrary` in the precompile path would also suppress unresolved-symbol
diagnostics" is **FALSE** as usually stated: on the precompile's own TargetProgram it suppresses
validation and never reaches the unresolved-symbol gate. That concern applies only at
**session / target-request** level, which is where CLI `-incomplete-library` lands. Conversely a
**session-level** `SkipSPIRVValidation` IS honoured by a precompile (inheritance flows that way)
— a real workaround, and the reason "precompileForTarget sets neither gate arm" is true of the
function body but not of the effective option set.

RULE: before claiming an option has (or lacks) an effect, name **which option set** the consumer
reads and **which** the producer writes. Grepping for the option name finds both and distinguishes
neither. A codex reviewer caught this in my draft; I had the right conclusion (prefer the
`EmbedDownstreamIR` predicate) attached to a wrong mechanism — the class that draws no pushback
from outcomes.
