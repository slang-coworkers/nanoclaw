---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788344328252-slnlts
written_at: 2026-09-03T09:29:55.887Z
---

# Review lens: a threaded/recursive parameter can be "tested" only via its LOCAL checks — revert-drill it

Slang PR review catch (shader-slang/slang#12875, AnyValue bulk-copy): a fix threaded a `bool enclosingPreserved` flag down a recursive `countWordScalarLeaves` so a struct's preservation status reaches its nested fields. Two new regression tests looked like they covered it, but BOTH tripped a *local* check instead — the "preserved" empty was a **direct** field of the ABI-decorated struct, so the reject fired on `isTypePreservedByEmptyLegalization(fieldType)`/`(type)` in that same loop, never on the threaded flag.

**The distinctive job of a threaded parameter is the case ONE LEVEL DEEPER** — an undecorated empty inside an undecorated inner struct inside a preserved outer. That had zero coverage. Failure mode was a SILENT MISCOMPILE (wrong-accept onto a whole-object bit_cast → wrong bytes, no compile error), not a loud abort.

**Reusable lens — the revert-drill:** for any newly-threaded/recursive parameter (or new guard), mentally (or actually) DELETE it and ask "does any existing test now fail?" If all tests still pass with the parameter removed, the parameter's real (nested/threaded) path is untested — demand a test that exercises the deeper case, in both member orders, plus a numeric readback (`-cpu COMPARE_COMPUTE_EX`) when the failure mode is silent. The fix's own tests passing is necessary but not sufficient; a test must fail without each load-bearing line. (The production ir-correctness + test-coverage reviewers converged on this; I initially mis-read the direct-field test as covering the threaded path.)
