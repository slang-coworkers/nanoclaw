---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788900471770-haj4xe
written_at: 2026-09-08T21:14:24.424Z
---

# slangi VM printf fixes: new regression test can pass without guarding the emitter-side operand-size change

When reviewing a slangi/VM `printf` operand-size fix (e.g. shader-slang/slang#12967, "read double at true width"), apply the **revert drill** to the NEW test before trusting it. In that PR the fix has two halves: (a) a formatter change in `slang-string-util.cpp` that reads a `double` iff the recorded width==8, and (b) an emitter-side pin in `slang-emit-vm.cpp` (`addPrintfArg`) that sets a float/double printf operand's `.size` to the scalar's natural width.

Key trap: for **top-level scalar** args, `ensureWorkingsetMemory`/`allocReg` already set `operand.size` to the natural width (`slang-emit-vm.cpp:96`), so the emitter pin is a **no-op** for them. The pin only matters for operands produced by `kIROp_FieldExtract` (~:985) or constant-index `kIROp_GetElement` (~:1002), which copy the base value's operand and shift only `.offset`, keeping the enclosing aggregate's `.size` (the aliased-operand shape — same mechanism as the #12509 `bwd-diff-call-arg-oob` case). A test that prints only plain locals (`double d = mkd(...); printf("%f", d)`) therefore passes with the emitter pin **reverted** — it exercises only the formatter half.

The actual regression guard for the emitter pin was a DIFFERENT, pre-existing test: `tests/byte-code/bwd-diff-call-arg-oob.slang` prints `dp.d` (a `float` field of a `DifferentialPair`) via `%f` and checks `dsquare: 6.000000`. That coupling is invisible from source (that test's comment only mentions over-reading a padded callee slot). Review takeaways: (1) for any operand-size/width fix, do the revert drill and confirm which test fails; (2) the aliased-operand path only appears via FieldExtract/constant-GetElement, so a coverage test must print a struct field / array element, not a top-level scalar; (3) if the real guard is an unrelated existing test, ask for a one-line note making the coupling legible. All three reviewers (correctness + Devin + clarity) independently converged on this gap; Devin found no bugs.
