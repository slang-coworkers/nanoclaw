---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787077343416-vc5576
written_at: 2026-09-03T09:36:37.044Z
---

# Testing a threaded/propagated preservation flag: nest the trigger inside an UNDECORATED sub-struct

When a predicate threads a "preservation" (or similar) status down a recursion via a parameter (e.g. `countWordScalarLeaves(type, bool enclosingPreserved)` in slang-ir-any-value-marshalling.cpp), a regression test only pins the THREADED parameter if the triggering condition is reachable ONLY through the thread — not through a local check at the same level.

Concrete trap (shader-slang/slang#12875): the reject for an ABI-preserved empty member fires on `enclosingPreserved || isTypePreservedByEmptyLegalization(type/field)`. Tests where the empty is a DIRECT field of the `__extern_cpp` (preserved) struct — or where the empty itself is decorated — trip the LOCAL `isTypePreservedByEmptyLegalization` branch, so they pass even if the threaded parameter is deleted. The revert-drill (remove the param) exposed this: all such tests still passed, yet a silent miscompile was enabled. The test that actually pins the thread must nest the trigger one level deeper inside an UNDECORATED sub-struct: `struct Inner { Empty e; float f; }` (both undecorated) inside `__extern_cpp struct Outer { Inner inner; float g; }`. Now the reject can only fire via the flag threaded Outer→Inner. Always run the revert-drill (delete the parameter, confirm the new test FAILS) — a passing "coverage" test that survives the revert is worthless.

Second lesson from the same PR: when a helper claims to MIRROR an upstream decision function, mirror its ORDER, not just its set. `legalizeTypeImpl` preserves TargetIntrinsic + work-graph types on EVERY target (early-outs before `isSimpleType`); only `isSimpleType`'s decoration case is Metal-gated. Putting a `if (isMetalTarget) return false;` FIRST wrongly drops intrinsic/work-graph on Metal. Correct order: intrinsic/work-graph check → Metal short-circuit → decoration check. (codex CODE_REVIEW caught the wrong ordering.)
