---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787092990177-j2ebuj
written_at: 2026-08-18T23:45:14.301Z
---

# Slang divergence analysis: switch without default falls through to exit (unsound as a terminator); discard is not a terminator either

**Context:** Designing the "else must diverge" contract for guard-style `let ... else` (shader-slang/slang#12612). Any Slang feature that needs to prove a block/statement "does not complete normally" (guard bindings, exhaustiveness, dead-code) must get the accepted terminating forms exactly right — an over-broad set is a *soundness* bug (control falls through to code that assumed it wouldn't run).

**Verified firsthand (master, HEAD ~`0b78add933`):**

- **`switch` with no `default` FALLS THROUGH to the switch exit.** `slang-lower-to-ir.cpp:9607`: `auto defaultLabel = info.defaultLabel ? info.defaultLabel : breakLabel;` — when there is no `default` case, the unmatched-selector path is routed to `breakLabel` (the switch's exit/continuation), NOT to any diverging arm. So "every explicit `case` arm diverges" does **NOT** make the `switch` diverge — a selector value matching no case flows straight past. A `switch` can only be treated as diverging if it has a `default` AND every arm (including `default`) diverges (exhaustiveness). Safest for a v1: **exclude `switch` entirely**; accept only `if/else` where **both** arms diverge.

- **`discard` is NOT a control-flow terminator.** In the Lua defs (`slang-ir-insts.lua`) the `TerminatorInst` group (~lines 1451-1534) includes `throw` (:1491 → `IRThrow : IRTerminatorInst`, `slang-ir-insts.h:2177`) but **`discard` (:1536) is a sibling OUTSIDE the group**; `visitDiscardStmt` (`slang-lower-to-ir.cpp:9059-9063`) emits `emitDiscard()` with no trailing `emitUnreachable`. Shader `discard` flags the fragment for culling but **execution continues**. So a block ending in `discard` completes normally. Fall-through is decided by the **class-hierarchy** `getTerminator() = as<IRTerminatorInst>(...)` (`slang-ir.h:1218`, used by `isBlockTerminated` `slang-lower-to-ir.cpp:8153`) — NOT the coarser enum-switch `isTerminatorInst(IROp)` at `slang-ir.cpp:957-975` (which happens to list neither throw nor discard). Use the class-hierarchy notion when reasoning about lowering fall-through.

- **`throw` diverges only conditionally:** an *uncaught* throw needs the enclosing function to have a non-`Never` error type, else `throw` is itself a checker error (`slang-check-stmt.cpp:639-646`); a locally `catch`-handled throw does not diverge past the catch.

- **`break`/`continue` diverge only if their resolved target is OUTSIDE the block under test** — one captured by a loop/switch nested inside the block doesn't make the outer block diverge.

- **Unconditional terminating forms:** `return`, `break`, `continue` (target-outside caveat). Everything else is conditional or excluded.

**Meta-lesson:** when enumerating "terminating/diverging" statement forms, each candidate must be checked against how it actually LOWERS (does it cap the block with an `IRTerminatorInst`?), not against intuition. `switch`-no-`default` and `discard` both *look* terminating but fall through. An independent critique (codex) caught the `switch` over-reach that a first-pass design note missed — a good argument for a second set of eyes on soundness-critical enumerations.
