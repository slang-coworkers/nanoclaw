---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787093778289-z2m79j
written_at: 2026-08-18T23:10:19.589Z
---

# Slang: discard is NOT an IR terminator — excludes it from any divergence/no-fall-through check

When designing any "this block must not complete normally" check in Slang (e.g. `let ... else` guard binding, #12612), `discard` must be EXCLUDED from the set of accepted terminating forms — this is a soundness requirement, not a style choice.

**Why (verified at HEAD 0b78add933):**
- Block fall-through during lowering is decided by `IRBlock::getTerminator()`, which uses the CLASS HIERARCHY: `as<IRTerminatorInst>(getLastDecorationOrChild())` (slang-ir.h:1218). `startBlockIfNeeded`/`isBlockTerminated` (slang-lower-to-ir.cpp:8211, 8153) key fall-through off it.
- `return`/`break`/`continue` emit true terminators, and `IRThrow : IRTerminatorInst` (slang-ir-insts.h:2177) — so a block ending in any of these is capped; control does NOT fall through.
- BUT `kIROp_Discard` sits OUTSIDE the `TerminatorInst` group in slang-ir-insts.lua (discard at :1536; group ends ~:1534). `isTerminatorInst(op)` (slang-ir.cpp:957-975) omits BOTH Discard and Throw from its enum switch (Throw is still a terminator via its class base; Discard is not a terminator at all). `visitDiscardStmt` (slang-lower-to-ir.cpp:9059-9063) emits `emitDiscard()` with NO following `emitUnreachable()`.
- Shader semantics agree: `discard` flags the fragment for culling but execution CONTINUES past it. So an `else { discard; }` completes normally → falls through to the code after the guard (e.g. unwrapping a `none` Optional). Unsafe.

**Also useful for the same class of feature:**
- Slang has NO checker-level reachability/"completes normally" analysis (grep `diverges|terminates|fallsThrough|completesNormally|reachability` in slang-check*.cpp → 0 hits). Missing-return is diagnosed structurally at IR level (IRMissingReturn, slang-lower-to-ir.cpp:14366-14373; slang-ir-missing-return.cpp) — models FUNCTION exit, wrong layer for a mid-block guard.
- `Never`/`BottomType` is wired ONLY as the throws/try error-type slot; nothing produces or consumes a function RESULT type of `Never`. The `FuncType::getResultType()` doc comment (slang-ast-type.h:1059-1060) reserves it in intent but it is inert — you cannot lean on a "[noreturn]/Never call" today. `throw` as a terminating form is also conditional: only well-formed if the enclosing function has a non-`Never` error type, else `throw` is itself a checker error (slang-check-stmt.cpp:642).
- Net accepted structural set for a v1 divergence check: `return`, `break`, `continue`, `throw`(if error-typed), and nested if/switch where every arm diverges. NOT `discard`, NOT an arbitrary function call.
