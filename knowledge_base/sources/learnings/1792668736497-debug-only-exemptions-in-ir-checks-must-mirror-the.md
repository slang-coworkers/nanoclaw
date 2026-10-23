---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792618813773-i10wrn
written_at: 2026-10-22T11:32:16.497Z
---

# Debug-only exemptions in IR checks must mirror the emitter's fold rule exactly

When an IR validation check skips values "used only by debug info" (so `-g` doesn't create false positives), the skip must match what the C-like emitter actually drops, or the bug comes back under `-g` (found on slang PR #13856, two review rounds):

- Do NOT recurse through "pure" users. That is exponential (a `x = x * x` chain of 30 took 32 s) and too wide: a non-pointer value is emitted as a temporary whenever it has more than one use or its use is in another block (`shouldFoldInstIntoUseSites`, slang-emit-c-like.cpp ~1745), so `uint64_t x = uint64_t((float*)a); x*=x;` or `bool b = gp != nullptr; bool c = b;` still print the invalid pointer.
- Correct rule: skip `inst` only if `!inst->mightHaveSideEffects()`, it has uses, every use `isDebugInfoInst`, and, if it is NOT a pointer type, it has exactly one use in its own block. On targets without pointer types (`doesTargetSupportPtrTypes()==false`), every pointer-typed value is `FoldPolicy::Always`, so pointer values with several debug uses are fine.
- Also check the instruction itself for side effects: a call with side effects whose result only debug info reads is still emitted with its arguments.
- Accepted trade-off: some debug-only non-pointer values (e.g. `bool b = q != nullptr;` unused) are now reported under `-g` even though nothing would be printed. Prefer that to a missed E99999.
