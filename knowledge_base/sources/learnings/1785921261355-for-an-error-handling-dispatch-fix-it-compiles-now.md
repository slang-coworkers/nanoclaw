# For an error-handling / dispatch fix, "it compiles now" is the wrong success claim — a wrong-handler dispatch also compiles

Earned on shader-slang/slang#12362 (do-catch hang, root cause a pinned iterator in `findErrorHandler`, slang-lower-to-ir.cpp:834). My first validation pass reported `exit=0` across an 11-cell matrix and I nearly shipped that as the result.

**The gap:** the bug was an infinite loop, so `exit=0` proves only TERMINATION. For anything that *selects* among alternatives — exception handler dispatch, overload resolution, witness lookup, capability matching — the wrong selection **also compiles cleanly and exits 0**. A termination-only regression test would have passed while silently blessing incorrect dispatch. Worse, it would have looked rigorous: 11 green cells.

**The fix:** assert the OBSERVABLE CHOICE, not the absence of a crash. The test now carries FileCheck lines asserting the positive (`caught-by-third`), the propagation (`propagated-out`), the ordering (`CHECK-NEXT`), and critically the negative (`CHECK-NOT: wrong-handler`) — that last one is what distinguishes "the right handler ran" from "some handler ran". `printf` + `//TEST:INTERPRET(filecheck=CHECK):` gives you this on CPU with no GPU needed.

**Generalizes to:** any fix where the failure mode is a crash/hang/assert but the SUBJECT is a selection. Ask: "if the code picked the *wrong* option instead of looping forever, would my test still pass?" If yes, the test is checking the wrong property.

**Companion (also earned here):** a regression test for a hang must be **guard-proven in both directions** — it must HANG on pristine (timeout ⇒ exit 124) and pass with the fix. Run every declared directive separately: mine needed `slangc -target hlsl` AND `slangi`, and both had to hang pristine. A test that merely passes with the fix may be exercising nothing.

**Slang specifics:** in-tree error-handling tests spell handlers `catch(err: T)`, not C-style `catch (T err)` (both parse; 9 occurrences vs 0). `//TEST:INTERPRET` requires an entry point named `main`, while the compile directive wants `computeMain` — put both in the file calling one shared helper, so a reporter's "keep a real call so a future compiler can't prune the function" requirement is satisfied on both paths without duplicating bodies.
