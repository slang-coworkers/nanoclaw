---
name: feedback-a-justified-relaxed-assertion-can-make-a-test-vacuous
description: "A regression test passed 1/1 while render-test bailed on an unknown option and never reached the code under test — the vacuum was created by a WELL-REASONED decision not to assert the result code; assert the subject EXECUTED, separately from the property"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: aca60d25-6de7-4dad-b49c-1719f9d3edd0
---

# A relaxed assertion with a good rationale is how a regression test becomes vacuous

**Measured 2026-08-10 (slang #12442, `slang-fixer`'s finding on its own test).** A new `slang-unit-test` was
written to catch a prelude leak deterministically: create a private session, set a distinctive HLSL prelude,
load `render-test-tool`, call the exported `innerMain`, assert the prelude is byte-identical afterwards.

It reported `100% (1/1)` **having exercised nothing.** The invocation passed `-target`, which render-test
does not accept (it takes `-cpu -compute`), so it bailed at option parsing — **before ever reaching
`_setSessionPrelude`** — and the prelude was trivially unchanged.

⛔ **The vacuum was created by a deliberate, well-argued decision.** The author had written *"the result code
is deliberately not checked"* with a real rationale: **an early-bail run must still restore what it
borrowed** — which is true, and is a property worth testing. That reasoning is exactly what removed the only
signal that the subject had run at all. ⇒ **A relaxed assertion defended by sound reasoning is more
dangerous than a careless one, because the rationale survives review.** "Don't check the result" *looks* like
the more principled choice.

## The fix, and the general shape

✅ **Assert that the subject EXECUTED, as a separate assertion from the property under test.** Here:
`SLANG_SUCCEEDED(innerMainResult)` **plus** the prelude comparison — with a comment saying why the execution
check must be there, since its absence reads as principled.

⇒ **Two assertions, two jobs:** *did the code under test run?* and *did it behave?* Collapsing them, or
dropping the first because a broader contract permits early exit, yields a test that is green in the one
state you most need to detect. If both the pass and the fail path of your test would return the same value
when the subject never ran, the test cannot distinguish "correct" from "absent".

⚠ **What exposed it was noise sitting next to the green:** `error 1004: unknown command-line option
'-target'` was in the log beside `100% (1/1)`. Nothing in the *result* could have revealed it. Same detector
as the two grep misses on this chain — **an independent signal in the same output contradicting the
verdict**, never a re-reading of the verdict.

## Sibling instance, same session — a positive control catching a broken probe

Checking whether a CMake dependency edge existed: `ninja -n slang-unit-test | grep render-test` → **0**, read
as "the edge is missing". Same probe against `slang-test`, which has required render-test for years → **also
0**. ⇒ probe invalid, not the dependency. Valid instrument: query the output node —
`ninja -t query Debug/lib/libslang-unit-test-tool.so` shows `|| Debug/lib/librender-test-tool.so`. **Without
the positive control they would have "fixed" a working CMake file.**

⭐ Both failures in one session, same root: **reasoning about an instrument instead of reading what it
emitted.** See [[feedback_control_the_instrument_not_the_reasoning]] and
[[feedback_a_counter_result_is_a_property_of_tool_times_redirection]] (the four-instance family, split into
instrument vs wrong-population failures).

## Third item, worth keeping for CMake work in this repo

The **idiomatic-looking edit was the broken one.** `REQUIRED_BY slang-test slang-unit-test` inside
render-test's own `CMakeLists.txt` — matching the idiom already there — is a configure error (`Cannot add
target-level dependencies to non-existent target`), because `add_subdirectory(render-test)` at
`tools/CMakeLists.txt:391` runs **before** `slang-unit-test` is declared at `:393`. The working direction is
`REQUIRES render-test` on `slang-unit-test`. ⇒ **declaration order beats idiom in CMake; matching a nearby
pattern is not evidence it can work from your position in the graph.**
