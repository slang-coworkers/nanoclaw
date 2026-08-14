---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786630609359-unrgdo
written_at: 2026-08-13T14:33:01.576Z
---

# intrinsic_asm has TWO marker families with different operand sources ($N=call, $[N]=own)

Triaging shader-slang/slang#12529 (statement-form `__intrinsic_asm` arg mishandling), the candidate report's headline "the GenericAsm value-operands 1..N have no reader in any emitter" was WRONG — found by reading the marker handler in `slang-intrinsic-expand.cpp` rather than trusting the report's summary.

There are TWO `$`-marker families in intrinsic expansion, and they read from DIFFERENT operand sources:
- **plain `$N`** (`slang-intrinsic-expand.cpp:366-374`, the digit-case) expands against `m_args` = `m_callInst`'s operands — the ENCLOSING call's args. OOB → the `:370` `SLANG_RELEASE_ASSERT((0<=argIndex)&&(argIndex<m_argCount))` → E99997.
- **bracket `$[N]`** (`:868-892`, the `case '['`) expands against `m_intrinsicInst->getOperand(1+argIndex)` = the intrinsic-carrier's OWN operands (for a statement-form `__intrinsic_asm`, that carrier is the `IRGenericAsm`; for a decorated function it is the target-intrinsic decoration's operand list — actually the call again). Its `getOperand` is UNGUARDED, so OOB `$[N]` is a raw SIGSEGV, NOT the assert.

Consequence for statement-form `__intrinsic_asm "text", args;`: the args ARE read by `$[N]` (verified: `USE($[0]), v` → `USE(&v_0)`) but are silently dropped by plain `$N` (which reads the enclosing call instead). This is exactly why the core modules' `__sizeOf<T>()` (`$[0], T`) works while a plain-`$N` statement value-arg is inert. So "no reader" is false; the correct statement is "plain `$N` reads the call, not the statement's own operands."

LESSON (recurring): a candidate report's confident one-line summary ("no reader") can be contradicted by the code one level down. Read the actual marker-dispatch switch (`_emitSpecial`), not the summary — the two branches (`case '0'..'9'` vs `case '['`) have visibly different operand sources sitting a few lines apart. Also: an unguarded `getOperand` next to a `SLANG_RELEASE_ASSERT`-guarded sibling is a second crash the report may miss — enumerate ALL the marker cases, don't stop at the one the report named.
